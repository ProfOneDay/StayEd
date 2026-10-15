# StayEd: Deployment & Maintenance Handoff

> **For the AI assistant reading this:** you're helping King (student, capstone group) maintain and patch **StayEd**, which is already deployed and live. Read this whole file before suggesting changes. King is comfortable with VS Code and Git but new to Linux servers, so give exact, copy-pasteable commands one step at a time and say clearly whether each one runs on the **laptop (PowerShell / VS Code)** or on the **server (`root@stayed`)**. Never ask King to paste passwords or API keys into chat, and don't ask for screenshots of `.env`.

*Last updated: Oct 15, 2026 (Brevo SMTP configured, see §6.8)*

---

## 1. What StayEd is

An early dropout-risk monitoring system for ALS (Alternative Learning System) learners. Users: Admin, Teacher (and a public student-portal lookup).

| Layer | Tech |
|---|---|
| Frontend | Static HTML / CSS / vanilla JS (`StayEd_Frontend/`) with no build step |
| Backend | Python **Flask** API (`StayEd_Backend/`), all routes under `/api/*`, JWT auth |
| Database | **PostgreSQL 16** |
| ML | **XGBoost** dropout-risk classifier (`models/train_model.py` → `models/stayed_xgb_v2.joblib`), called through `models/predict_bridge.py` via the `MODEL_COMMAND` env var |
| AI | OpenAI (`gpt-4o-mini`) for intervention recommendations (`app/services/ai_intervention_service.py`) |
| Email | Brevo SMTP, sender `no-reply@stay-ed.site` (**configured Oct 15, 2026**, see §6.8) |

- **Repo:** https://github.com/ProfOneDay/StayEd (public, branch `main`)
- **King's local repo folder:** `C:\Users\Admin\Desktop\STAYED FOLDER CAPSTONE DONT DELETE\StayEd`

---

## 2. Live environment

| Item | Value |
|---|---|
| Live URL | **https://stay-ed.site** (also `https://www.stay-ed.site`) |
| Host | **Vultr** Cloud Compute, Regular Performance `vc2-1c-2gb` (1 vCPU, 2 GB RAM, 55 GB SSD), Singapore, **$10/mo**, Auto Backups **OFF** |
| Server IP | `45.76.183.119` (hostname `stayed`) |
| OS | **Ubuntu 24.04 LTS**. ⚠️ Do **not** run `do-release-upgrade` (the login banner suggests 26.04) |
| Login | `ssh -o ServerAliveInterval=30 root@45.76.183.119` (root password is in the Vultr dashboard; King has it) |
| Domain | `stay-ed.site` on **Namecheap**, registered Oct 12 2026 → **expires Oct 12 2027**, **auto-renew OFF**, WithheldForPrivacy ON |
| DNS (Namecheap → Advanced DNS) | `A @ → 45.76.183.119`, `A www → 45.76.183.119` (the default parking CNAME/redirect were removed), plus 7 Brevo domain-authentication records added Oct 15, 2026 (see §6.8) |
| HTTPS | Let's Encrypt via certbot (nginx plugin), issued Oct 12 2026, expires Jan 10 2027, **auto-renews** (systemd timer) |

### How requests flow

```
Browser ──HTTPS──▶ nginx (:443, :80 redirects to 443)
                     ├── /        → static files from /opt/stayed/StayEd_Frontend
                     └── /api/... → gunicorn (Flask) on 127.0.0.1:8000 → PostgreSQL 127.0.0.1:5432 (stayed_db)
```
The frontend and API share one origin, so CORS isn't involved in production.

### Server layout

| Path / thing | Purpose |
|---|---|
| `/root/stayed-repo` | `git clone` of the GitHub repo, the **source** for updates |
| `/opt/stayed/StayEd_Backend` | Running backend (rsync'd from the repo by the setup script) |
| `/opt/stayed/StayEd_Frontend` | Served by nginx |
| `/opt/stayed/StayEd_Backend/.env` | **Production secrets** (chmod 600). Never commit it, never print it |
| `/opt/stayed/StayEd_Backend/.venv` | Python virtualenv (Python 3.12) |
| `/opt/stayed/StayEd_Backend/models/stayed_xgb_v2.joblib` | Trained model (generated on the server, not in git) |
| Linux user `stayed` | Runs the app (system user, no login) |
| systemd unit `stayed` | `/etc/systemd/system/stayed.service`: gunicorn `run:app`, 2 workers, bind `127.0.0.1:8000`, timeout 120 s, auto-restart |
| nginx site | `/etc/nginx/sites-available/stayed` (certbot added the 443 block) |
| Postgres | Local install, DB `stayed_db`, role `stayed` (random password, stored only in `.env`) |
| Firewall | `ufw`: OpenSSH + Nginx Full only |
| Swap | 2 GB `/swapfile` |
| `/etc/cron.daily/stayed-backup` | Daily DB backup script (see §6.4); not in git, lives only on the server |
| `/root/backups` | Daily `stayed_YYYY-MM-DD.sql.gz` dumps, last 14 days kept |

### Production `.env` keys (values intentionally omitted)
`FLASK_ENV=production`, `FLASK_DEBUG=0`, `SECRET_KEY`, `JWT_SECRET_KEY` (both **rotated** after deploy), `DATABASE_URL` (local Postgres), `FRONTEND_ORIGINS=https://stay-ed.site,https://www.stay-ed.site`, `TRUSTED_PROXY_COUNT=1`, `AUTO_PROVISION_DB=0`, `MODEL_COMMAND='"/opt/stayed/StayEd_Backend/.venv/bin/python" "/opt/stayed/StayEd_Backend/models/predict_bridge.py"'`, `STAYED_RISK_CLASS=NotCompleted`, `OPENAI_API_KEY` (**set**), `OPENAI_MODEL=gpt-4o-mini`, `SMTP_*` (**set** — Brevo, see §6.8).

---

## 3. Changes made to the codebase for deployment

| Commit | Files | What / why |
|---|---|---|
| `a99ddb3` *Add Vultr deployment setup* | `deploy/setup_server.sh`, `deploy/stayed.service`, `deploy/nginx-stayed.conf`, `deploy/DEPLOY_VULTR.md` | New deployment tooling (see §4) |
| same | `StayEd_Frontend/assets/js/config.js` | `API_URL` was hard-coded to `http://127.0.0.1:5000/api`. It now uses that on `localhost`/`127.0.0.1` and **`/api` (relative)** everywhere else, so local dev still works unchanged |
| same | `StayEd_Backend/requirements.txt` | Added `gunicorn>=23,<24` |
| `71a68b7` *Fix demo seeding for deployment* | `StayEd_Backend/seed_demo.py` | The `risk_assessment` insert used `ON CONFLICT (model_id, enrollment_id, monitoring_start_date, monitoring_end_date)`, but `sql/29_risk_assessment_history.sql` **dropped** that unique constraint, so on a fresh DB the seed crashed with `InvalidColumnReference`. It's now a SELECT-then-UPDATE/INSERT, so re-runs are still idempotent. (This would also have broken local seeding on a fresh DB.) |
| same | `deploy/setup_server.sh` | Seeding now runs whenever **no ADMIN user exists** (self-heals a half-finished run), and model training runs **after** seeding so the real XGBoost model ends up as the single ACTIVE `model_info` row (the seed inserts a demo `rf-v1-demo` row as ACTIVE) |
| `ae2cdc8` *Keep HTTPS: re-attach existing Let's Encrypt cert when setup_server.sh re-runs* (Oct 13) | `deploy/setup_server.sh` | Re-attaches the existing HTTPS cert after rewriting the nginx config. Before this fix, re-running the script for an update reverted the site to HTTP-only |
| `cf13de1` *Setup wizard: Back to Login signs out so landing.js does not redirect back* (Oct 13) | `StayEd_Frontend/assets/js/setup/setup.js` | The wizard's step-1 "Back to Login" only called `Router.go("/login")` → `/index.html`, but `index.html` loads `assets/js/public/landing.js`, which calls `Auth.redirectAfterLogin()` when a session is valid, and a teacher with `setup_completed === false` is sent straight back to `setup-wizard-1.html` (a loop, so the button looked dead). It now calls `Auth.logout()` first. Frontend-only; deployed Oct 13 with the §6.1 quick rsync path |

Nothing else in the app code was changed.

---

## 4. `deploy/setup_server.sh`: what it does (idempotent; safe to re-run)

Usage on the server: `bash deploy/setup_server.sh stay-ed.site`

1. `apt-get update/upgrade`; installs python3-venv, build tools, postgresql, nginx, certbot, ufw, rsync
2. Creates the 2 GB swap (if missing)
3. Creates the `stayed` user; **rsyncs** `StayEd_Backend` + `StayEd_Frontend` from the repo into `/opt/stayed` with `--delete`, **excluding** `.env`, `.venv`, `__pycache__`, `models/*.joblib`, `*.log`
4. **First run only** (if `.env` doesn't exist): creates the Postgres role/DB with a random password and writes `.env` with fresh secrets. Later runs **keep the existing `.env`**
5. Applies **all** `sql/*.sql` **only if the `users` table doesn't exist** (fresh DB). On an existing DB it skips SQL entirely (see §6.3)
6. Creates the venv and runs `pip install -r requirements.txt`
7. Runs `seed_demo.py` if no ADMIN user exists
8. Trains the model if the `.joblib` is missing or if it just seeded
9. Installs/restarts the systemd service, writes the nginx config from the HTTP-only template, reloads nginx
10. **If a Let's Encrypt cert already exists** for the domain, re-attaches it (`certbot --nginx --reinstall --non-interactive`), so re-runs keep HTTPS
11. Configures ufw, then health-checks `http://127.0.0.1:8000/api/health`

On the very first run there's no cert yet; HTTPS was then enabled once, manually, with `certbot --nginx -d stay-ed.site -d www.stay-ed.site --redirect`.

---

## 5. Problems hit during deployment (and the fixes)

| Problem | Cause | Fix |
|---|---|---|
| `psycopg.errors.InvalidColumnReference: no unique or exclusion constraint matching the ON CONFLICT` during seeding | Seed out of sync with migration 29 | Patched `seed_demo.py` (commit `71a68b7`) |
| `cd /root/stayed-repo` / `bash` errors in PowerShell (WSL error) | Server commands typed on the **laptop** | Check the prompt is `root@stayed:...#` before running server commands |
| SSH "Connection closed / reset" | Idle or slow password paste | Use `ssh -o ServerAliveInterval=30 ...`; paste the password with Ctrl+V right away (nothing echoes) |
| `^M` shown, Enter not working in the VS Code terminal | Terminal left in a weird mode after nano | Close the terminal tab and reconnect; standalone Windows PowerShell is more reliable (right-click = paste) |
| Commands copied from chat had `[www.x](https://www.x)` | Chat link formatting | Type domains manually or paste via Notepad |
| Secrets visible in a screenshot | `.env` opened in nano and screenshotted | Rotated `SECRET_KEY` + `JWT_SECRET_KEY` with `sed` + `openssl rand -hex 32` |

How the OpenAI key was set without nano (useful pattern for any secret):
```bash
cd /opt/stayed/StayEd_Backend
read -rsp "Paste value: " K; echo; sed -i "s|^OPENAI_API_KEY=.*|OPENAI_API_KEY=$K|" .env; unset K
grep -c '^OPENAI_API_KEY=sk-' .env    # 1 = OK
systemctl restart stayed
```

---

## 6. Maintenance runbook

### 6.1 Deploy a code update (normal workflow)
**Laptop (VS Code terminal):** commit only the intended files, then push.
```powershell
git add <specific files>      # avoid `git add .` unless you checked `git status`
git commit -m "message"
git push
```
**Server:**
```bash
cd /root/stayed-repo && git pull && bash deploy/setup_server.sh stay-ed.site
```
Afterwards, confirm https://stay-ed.site still shows the 🔒. If it doesn't (the HTTPS-safe `setup_server.sh` has been in the repo since commit `ae2cdc8`, but the server must have pulled it), run:
```bash
certbot --nginx --cert-name stay-ed.site -d stay-ed.site -d www.stay-ed.site --redirect --reinstall --non-interactive
```
For **frontend-only** or small backend changes, a faster option skips apt/pip:
```bash
cd /root/stayed-repo && git pull
rsync -a --delete --exclude '.env' --exclude '.venv' --exclude '__pycache__' --exclude 'models/*.joblib' --exclude '*.log' \
  StayEd_Backend StayEd_Frontend /opt/stayed/
chown -R stayed:stayed /opt/stayed
systemctl restart stayed
```
If `requirements.txt` changed: `sudo -u stayed /opt/stayed/StayEd_Backend/.venv/bin/pip install -r /opt/stayed/StayEd_Backend/requirements.txt` then restart.

### 6.2 Everyday commands (server)
| Task | Command |
|---|---|
| Service status | `systemctl status stayed --no-pager` |
| Live backend logs | `journalctl -u stayed -f` (last 100: `journalctl -u stayed -n 100 --no-pager`) |
| Restart after `.env` change | `systemctl restart stayed` |
| Health check | `curl -s http://127.0.0.1:8000/api/health` |
| nginx errors | `tail -n 50 /var/log/nginx/error.log` |
| Test nginx config | `nginx -t && systemctl reload nginx` |
| DB shell | `sudo -u postgres psql stayed_db` |
| Disk / memory | `df -h /` · `free -h` |
| Cert status | `certbot certificates` · test renewal: `certbot renew --dry-run` |

### 6.3 Database migrations ⚠️
- New `sql/NN_*.sql` files are **NOT auto-applied** on the server (the script only runs SQL on a fresh DB). Apply each new one **once**, manually:
  ```bash
  cd /opt/stayed/StayEd_Backend
  sudo -u stayed bash -c 'set -a; . ./.env; psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f sql/37_new_migration.sql'
  ```
- **NEVER run `sql/00_core_schema.sql` on the server.** It begins with `DROP TABLE ... CASCADE` and wipes everything.
- Write migrations to be idempotent (`IF NOT EXISTS`, `DROP ... IF EXISTS`), like the existing ones.
- Locally, `app/db_bootstrap.py` (Docker-based) re-applies all non-00 SQL files on each start. That's why migrations must be idempotent. On the server, `AUTO_PROVISION_DB=0` disables it.

### 6.4 Backups
**Automatic (set up Oct 13, 2026):** `/etc/cron.daily/stayed-backup` runs once a day (cron.daily) and writes `/root/backups/stayed_YYYY-MM-DD.sql.gz` (folder is `chmod 700`). It writes to a temp file first and renames it only when the dump finishes, and it deletes backups older than **14 days**. Check with:
```bash
ls -lh /root/backups
run-parts --test /etc/cron.daily | grep stayed
```
⚠️ These backups live on the **same server**, so they do not protect against losing the server itself. Vultr Auto Backups are still **OFF**. Before demos/defense, also download a copy to the laptop (command below).

Manual dump (also use this right before migrations):
```bash
sudo -u postgres pg_dump stayed_db | gzip > /root/stayed_$(date +%F).sql.gz
```
**Off-server copy (laptop, PowerShell).** Backups contain student data and this repo is public, so download them to a folder **outside the repo**, never inside `StayEd\`:
```powershell
New-Item -ItemType Directory -Force "$HOME\StayEd-backups"
scp "root@45.76.183.119:/root/backups/*.sql.gz" "$HOME\StayEd-backups\"
Get-ChildItem "$HOME\StayEd-backups"
```
The first off-server copy was made on Oct 13, 2026 (`stayed_2026-10-13.sql.gz`, ~17 KB, in `C:\Users\Admin\StayEd-backups`). The root password is asked each time (it's in the Vultr dashboard). Repeat before demos/defense and after big changes. Files made by hand (e.g. `/root/stayed_before_superadmin_*.sql.gz`) are in `/root/`, not `/root/backups/`, so fetch those by their exact path.
Restore (destructive): `gunzip -c file.sql.gz | sudo -u postgres psql stayed_db`
**Always back up before applying migrations or before demos/defense.**

### 6.5 OS patching
```bash
apt-get update && apt-get upgrade -y     # security/package updates (fine to run)
[ -f /var/run/reboot-required ] && reboot  # if a kernel update requires it; service + nginx + postgres auto-start
```
Do **not** run `do-release-upgrade`.

### 6.6 Retraining the model
```bash
cd /opt/stayed/StayEd_Backend && sudo -u stayed .venv/bin/python models/train_model.py && systemctl restart stayed
```
This retrains from `models/data/stayed_modeling_dataset_demo.csv` and registers it as the ACTIVE `model_info` row. Deploy-time metrics: Accuracy 0.736, Precision 0.796, Recall 0.755, F1 0.775, ROC-AUC 0.812.

### 6.7 Super admin flags (needed after any fresh deploy / reseed)
`sql/36_admin_permissions.sql` adds `is_super_admin`, `can_manage_clcs`, `can_manage_users`, `admin_title` to `users` (all default `FALSE`) and promotes the admins that **already exist** when it runs, **once** (tracked in `data_seed_log`, key `existing_admins_full_permissions_backfill`). On a fresh server all SQL runs *before* `seed_demo.py`, so nothing is promoted, and the seeded `admin@stayed.com` ends up with every flag `f`. Symptom: after logging in as `admin@stayed.com`, the super-admin features (assigning admin permissions/titles) are missing.

Fix (server, back up first; done on Oct 13, 2026):
```bash
sudo -u postgres pg_dump stayed_db | gzip > /root/stayed_before_superadmin_$(date +%F).sql.gz
sudo -u postgres psql stayed_db -c "UPDATE users SET is_super_admin=TRUE, can_manage_clcs=TRUE, can_manage_users=TRUE, admin_title=COALESCE(admin_title,'Supervisor') WHERE email='admin@stayed.com' AND role='ADMIN';"
```
Expect `UPDATE 1`. The flags live in the JWT, so the admin must **log out and log in again** for the change to show. Check with: `sudo -u postgres psql stayed_db -c "SELECT email, is_super_admin, can_manage_clcs, can_manage_users, admin_title FROM users WHERE role='ADMIN';"`

### 6.8 Brevo SMTP configured (Oct 15, 2026)

**Background:** the original Brevo account (sender `capstonepang@gmail.com`, SMTP login `bc0a0...@smtp-brevo.com`) was **permanently suspended** by Brevo before it was ever wired into production. A new account was created to replace it.

**What was done:**
1. New Brevo account created (same team Gmail, `capstonepang@gmail.com`, as the login — a separate thing from the *sender* address below).
2. Domain `stay-ed.site` added under **Senders, Domains & Dedicated IPs → Domains** and authenticated via 7 DNS records added in Namecheap Advanced DNS: a `brevo-code` ownership TXT on `@`, two DKIM CNAMEs (`brevo1._domainkey`, `brevo2._domainkey`), a `_dmarc` TXT, and 3 branding CNAMEs (`mail`, `r.mail`, `img.mail`) for a branded-link subdomain. All 7 matched and the domain shows **Authenticated**.
3. Sender **`no-reply@stay-ed.site`** added under **Senders** — auto-verified instantly (no email-confirmation click needed) because the whole domain was already authenticated. DKIM and DMARC both show green for this sender, unlike the old Gmail-based sender, which Brevo flags "Freemail domain is not recommended."
4. New SMTP key generated (**SMTP & API → SMTP**, name `stayed-prod`, Standard variant, 1-year expiry). Login: `be3dd9001@smtp-brevo.com`.
5. Local `StayEd_Backend/.env` updated directly in the editor, then verified with a standalone `smtplib` test script (not via the Flask app) — login + send both succeeded against Brevo's relay.
6. Production `/opt/stayed/StayEd_Backend/.env` updated the same way as the OpenAI key (§5, `read -rsp` + `sed`, so the key never appeared on screen or in shell history): `SMTP_USERNAME=be3dd9001@smtp-brevo.com`, `SMTP_PASSWORD=<new key>`, `SMTP_FROM_EMAIL=no-reply@stay-ed.site`. Then `systemctl restart stayed`.
7. Confirmed end-to-end on the **live site**: rejected a test teacher application as admin; `journalctl -u stayed -f` showed the `POST /api/admin/users/<id>/reject` request succeed (200) with no mailer warning/exception logged (the mailer in `app/services/mailer.py` only logs on skip/failure, not on success); the rejection email arrived in the test account's real inbox.

**Note on the old TODO about SPF:** item 4 below previously assumed there was an existing Namecheap email-forwarding SPF TXT record on `@` that would need merging with Brevo's. At the time of this setup, no such record was present in Advanced DNS — only the records listed in step 2 above. Domain authentication succeeded without adding a separate SPF record (DKIM + DMARC were sufficient for Brevo). If email forwarding is set up on `@` later, double-check for an SPF conflict then.

**If the key ever needs rotating again:** repeat steps 4–6 above (generate a new key in the same Brevo account under the same sender/domain — no need to redo DNS or domain authentication).

---

## 7. Accounts & credentials (no secrets stored here)
- Seeded by `seed_demo.py`: **`admin@stayed.com`** and **`teacher@stayed.com`**, both with password **`12345678`**. This password is public (the repo is public). ⚠️ **Change both right away, or deactivate the demo teacher.** `seed_fill_gaps.py` (not run on the server) would add more demo admins. `seed_demo.py` creates `admin@stayed.com` with **no** super-admin flags; on the live server it was promoted manually on Oct 13, 2026 (see §6.7).
- Vultr root password: in the Vultr dashboard (Overview → Password).
- Production secrets: only in `/opt/stayed/StayEd_Backend/.env` on the server.
- OpenAI key: same key as in King's local `StayEd_Backend/.env`.
- Brevo: new account as of Oct 15, 2026 (the previous one was permanently suspended); login is the team Gmail (`capstonepang@gmail.com`). SMTP key is in `.env` only (local and production), not stored here.

---

## 8. Open TODOs / known issues (prioritized)

1. ✅ **DONE (Oct 13, commit `ae2cdc8`):** the HTTPS-safe `deploy/setup_server.sh` is pushed. Remaining: make sure the server's `/root/stayed-repo` has pulled it (`grep -c letsencrypt /root/stayed-repo/deploy/setup_server.sh` should be ≥1).
2. **Change the demo account passwords** (`12345678`) for admin and teacher.
3. ✅ **DONE (Oct 13, 2026):** Namecheap registrant email verified (Namecheap said the site would (re)activate within 24-48 hours). Confirm the yellow ALERT is gone and the site still loads.
4. ✅ **DONE (Oct 15, 2026):** Brevo SMTP configured end-to-end — new account (old one was permanently suspended), domain `stay-ed.site` authenticated, sender `no-reply@stay-ed.site` verified, production `.env` updated, confirmed delivered to a real inbox. See §6.8 for full detail.
5. ✅ **DONE (Oct 13, 2026):** daily `pg_dump` cron with 14-day rotation (see §6.4). A manual off-server copy to the laptop was made Oct 13 (see §6.4); repeat it regularly and before demos/defense. **Still open (optional):** make the off-server copy automatic, e.g. Vultr Auto Backups (+$2/mo).
6. *(Optional)* Rotate the Postgres role password. It appeared in a screenshot, but Postgres only listens on localhost, so the risk is low. If rotated: `ALTER ROLE stayed PASSWORD '...'`, update `DATABASE_URL` in `.env`, then restart.
7. *(Optional hardening)* SSH keys instead of the root password, then disable password login; install `fail2ban`.
8. **`config.js`** still has `MODE: "development"` and `DEBUG: true` (cosmetic/logging only; the API URL logic is already production-safe).
9. **Local repo housekeeping:** `seed_demo.py` has CRLF line endings (fine). Git warns "LF will be replaced by CRLF" on Windows, which is harmless; the server checkout uses LF.
10. ✅ **DONE (Oct 13, 2026):** promoted `admin@stayed.com` to super admin on the live DB (§6.7). **Optional code fix:** make `seed_demo.py` (or `setup_server.sh`) set the super-admin flags for the seeded admin, so a future fresh deploy doesn't need the manual `UPDATE`. This is a code change, so discuss and test before pushing.

---

## 9. Costs & renewals
| Item | Cost | Notes |
|---|---|---|
| Vultr server | ~$10/mo, billed hourly to the linked card ($0 prepaid deposit) | **Stopping does not stop billing. Destroy the instance when the project ends.** Back up the DB first |
| Domain `stay-ed.site` | $1.18 paid (1 yr incl. $0.20 ICANN fee) | Expires **Oct 12 2027**; `.site` renews at a much higher price; auto-renew is OFF |
| SSL | Free (Let's Encrypt) | Auto-renews every ~60 days |
| OpenAI | Pay-as-you-go on the key's account | `gpt-4o-mini`, low cost |

---

## 10. Local development (unchanged)
`start.ps1` launches the backend (`python run.py` on :5000, with Docker Postgres auto-bootstrap on :5433) and the frontend (`python serve.py 5500`). `config.js` automatically uses `http://127.0.0.1:5000/api` on localhost, so nothing needs switching between local and production.
