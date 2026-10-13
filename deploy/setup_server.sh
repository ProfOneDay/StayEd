#!/usr/bin/env bash
# StayEd one-shot server setup for a fresh Ubuntu 24.04 Vultr server.
#
# Usage (as root, from the folder you unzipped):
#   bash deploy/setup_server.sh yourdomain.com
#
# Safe to re-run: it keeps the existing .env, database and trained model,
# and only applies the SQL schema on a brand-new (empty) database.

set -euo pipefail

DOMAIN="${1:?Usage: bash deploy/setup_server.sh yourdomain.com}"
SRC_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR=/opt/stayed
BACKEND="$APP_DIR/StayEd_Backend"
FRONTEND="$APP_DIR/StayEd_Frontend"
APP_USER=stayed
DB_NAME=stayed_db
DB_USER=stayed

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

say "Installing system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y python3-venv python3-pip python3-dev build-essential \
  postgresql nginx certbot python3-certbot-nginx ufw rsync unzip openssl

say "Adding 2 GB swap (keeps small plans from running out of memory)"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

say "Creating app user and copying code to $APP_DIR"
id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin "$APP_USER"
mkdir -p "$APP_DIR"
rsync -a --delete \
  --exclude '.env' --exclude '.venv' --exclude '__pycache__' \
  --exclude 'models/*.joblib' --exclude '*.log' \
  "$SRC_DIR/StayEd_Backend" "$SRC_DIR/StayEd_Frontend" "$APP_DIR/"

say "Setting up PostgreSQL"
systemctl enable --now postgresql
if [ ! -f "$BACKEND/.env" ]; then
  DB_PASS="$(openssl rand -hex 16)"
  sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$DB_USER') THEN
    CREATE ROLE $DB_USER LOGIN PASSWORD '$DB_PASS';
  ELSE
    ALTER ROLE $DB_USER WITH LOGIN PASSWORD '$DB_PASS';
  END IF;
END \$\$;
SQL
  sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 \
    || sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"

  say "Writing $BACKEND/.env (secrets generated for you)"
  cat > "$BACKEND/.env" <<ENV
FLASK_ENV=production
FLASK_DEBUG=0
SECRET_KEY=$(openssl rand -hex 32)
JWT_SECRET_KEY=$(openssl rand -hex 32)

DATABASE_URL=postgresql://$DB_USER:$DB_PASS@127.0.0.1:5432/$DB_NAME
FRONTEND_ORIGINS=https://$DOMAIN,https://www.$DOMAIN

# nginx sits in front of gunicorn = exactly one proxy hop.
TRUSTED_PROXY_COUNT=1

# The Docker auto-setup is for local Windows dev only. Postgres is installed
# directly on this server, so keep this off.
AUTO_PROVISION_DB=0

MODEL_COMMAND='"$BACKEND/.venv/bin/python" "$BACKEND/models/predict_bridge.py"'
STAYED_R_MODEL=
STAYED_RISK_CLASS=NotCompleted

# Paste your key here, then: systemctl restart stayed
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini

# Brevo SMTP for approval / reset emails. Blank = emails are skipped.
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_FROM_EMAIL=
SMTP_FROM_NAME=StayEd
ENV
  chmod 600 "$BACKEND/.env"
else
  say "Keeping existing $BACKEND/.env"
fi
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

DATABASE_URL="$(grep '^DATABASE_URL=' "$BACKEND/.env" | cut -d= -f2-)"

say "Applying database schema (only on a brand-new database)"
HAS_USERS="$(psql "$DATABASE_URL" -tAc "SELECT to_regclass('public.users') IS NOT NULL")"
if [ "$HAS_USERS" != "t" ]; then
  # 00_core_schema.sql starts with DROP TABLE ... CASCADE, which is why this
  # block never runs again once the users table exists.
  for f in "$BACKEND"/sql/*.sql; do
    echo "  applying $(basename "$f")"
    psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 -f "$f"
  done
else
  echo "  database already has tables - skipped"
fi

say "Installing Python packages (takes a few minutes: pandas, xgboost, scikit-learn)"
sudo -u "$APP_USER" python3 -m venv "$BACKEND/.venv"
sudo -u "$APP_USER" "$BACKEND/.venv/bin/pip" install --upgrade pip wheel
sudo -u "$APP_USER" "$BACKEND/.venv/bin/pip" install -r "$BACKEND/requirements.txt"

# Seed only while no admin account exists yet (a fresh database, or a
# previous run that stopped before the seed finished).
SEEDED=0
HAS_ADMIN="$(psql "$DATABASE_URL" -tAc "SELECT EXISTS (SELECT 1 FROM users WHERE role='ADMIN')")"
if [ "$HAS_ADMIN" != "t" ]; then
  say "Seeding the admin account and demo data"
  (cd "$BACKEND" && sudo -u "$APP_USER" bash -c "set -a; . ./.env; set +a; .venv/bin/python seed_demo.py")
  SEEDED=1
fi

# Train after seeding: seed_demo.py registers its own 'rf-v1-demo' entry as
# ACTIVE, and training re-registers the real XGBoost model as the only
# ACTIVE one.
if [ ! -f "$BACKEND/models/stayed_xgb_v2.joblib" ] || [ "$SEEDED" = "1" ]; then
  say "Training the dropout-risk model"
  (cd "$BACKEND" && sudo -u "$APP_USER" .venv/bin/python models/train_model.py)
fi

say "Installing the backend service"
cp "$SRC_DIR/deploy/stayed.service" /etc/systemd/system/stayed.service
systemctl daemon-reload
systemctl enable stayed
systemctl restart stayed

say "Configuring nginx for $DOMAIN"
sed "s/__DOMAIN__/$DOMAIN/g" "$SRC_DIR/deploy/nginx-stayed.conf" > /etc/nginx/sites-available/stayed
ln -sf /etc/nginx/sites-available/stayed /etc/nginx/sites-enabled/stayed
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# The template above is HTTP-only. If an HTTPS certificate was already issued
# for this domain (certbot, see the end of this script), re-attach it so that
# re-running this script for an update never turns HTTPS off.
if [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
  say "Re-attaching the existing HTTPS certificate"
  certbot --nginx --cert-name "$DOMAIN" -d "$DOMAIN" -d "www.$DOMAIN" \
    --redirect --reinstall --non-interactive
fi

say "Firewall: allow SSH, HTTP, HTTPS only"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

sleep 3
say "Health check"
curl -fsS http://127.0.0.1:8000/api/health && echo || echo "Backend not answering yet - check: journalctl -u stayed -n 50"

cat <<DONE

------------------------------------------------------------------
 StayEd is installed.

 1. Once your Namecheap domain points to this server, turn on HTTPS:
      certbot --nginx -d $DOMAIN -d www.$DOMAIN --redirect

 2. Add your OpenAI key (and Brevo SMTP if you use email):
      nano $BACKEND/.env
      systemctl restart stayed

 3. Log in at https://$DOMAIN as admin@stayed.com / 12345678
    and CHANGE THAT PASSWORD right away (demo teachers use it too).
------------------------------------------------------------------
DONE
