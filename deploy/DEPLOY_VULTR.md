# Deploying StayEd on Vultr + Namecheap

How it runs on the server:

```
Browser ──https──> nginx (port 443)
                     ├── /            → static files in /opt/stayed/StayEd_Frontend
                     └── /api/...     → gunicorn (Flask) on 127.0.0.1:8000 → PostgreSQL
```

Frontend and API share one domain, so there's no CORS setup and no hardcoded IPs.
`deploy/setup_server.sh` does all of the server work for you.

---

## Part 1 — Vultr: account, payment, server

1. Sign up at **vultr.com** and verify your email.
2. **Billing → add a payment method.** Vultr takes Visa/Mastercard/AMEX/JCB, **PayPal**,
   Alipay, UnionPay, and crypto. PayPal or a debit card (e.g. GCash/Maya virtual card,
   BPI/BDO debit) works well from the Philippines. Follow the prompt to fund the account.
3. **Deploy → Deploy New Server**
   - Type: **Cloud Compute – Shared CPU**
   - Location: closest Asia region (Singapore is usually the lowest latency from PH)
   - Image: **Ubuntu 24.04 LTS x64**
   - Plan: **Regular Performance, 1 vCPU / 2 GB RAM ($10/mo)**. This is the recommended
     minimum. pandas + xgboost + scikit-learn + Postgres are too tight on 1 GB.
     (High Performance 2 GB at $12/mo is faster if you have the budget.)
   - Additional features: turn **Auto Backups off** unless you want to pay extra for it
   - Hostname: `stayed`
   - Click **Deploy Now**
4. Wait ~1 minute. Open the server and copy the **IP Address** and **root password**.

Billing is hourly up to the monthly cap. You're charged until you **destroy** the server.
Stopping it doesn't stop the charges.

---

## Part 2 — Upload the project and run the setup

On your Windows PC, open **PowerShell** in the folder containing `StayEd_deploy.zip`:

```powershell
scp StayEd_deploy.zip root@YOUR_SERVER_IP:/root/
ssh root@YOUR_SERVER_IP
```

Type `yes` at the fingerprint question, then paste the root password
(nothing shows while typing; that's normal).

Now on the server:

```bash
apt-get update && apt-get install -y unzip
unzip StayEd_deploy.zip -d /root/stayed
cd /root/stayed/StayEd
bash deploy/setup_server.sh yourdomain.com
```

Use your real domain from Part 3 (without `https://` or `www`). If you don't have it yet,
you can still run this with the planned name and re-run it later.

The script takes 5–10 minutes. It:
- installs Python, PostgreSQL, nginx, certbot, firewall, and 2 GB swap
- creates the database with a random password and writes `.env` with fresh secrets
- applies `sql/00 … 36` **once** (00 drops tables, so it never re-runs on a live DB)
- installs requirements, trains the XGBoost model, and seeds the admin and demo data
- starts the backend as a service that auto-restarts and survives reboots

Test it right away with `http://YOUR_SERVER_IP`. The login page should load.

---

## Part 3 — Namecheap: buy the domain

1. Go to **namecheap.com**, search for a name (e.g. `stayed-als.com`), and **Add to cart**.
2. In the cart:
   - Duration: 1 year
   - **Auto-renew**: your choice. Check the *renewal* price, which is usually higher than year 1.
   - Domain privacy is free. Leave it ON.
   - Untick any upsells (hosting, email, SSL). You don't need them because the SSL is free in Part 5.
3. Checkout. Pay with card or PayPal.

## Part 4 — Point the domain at Vultr

Namecheap → **Domain List** → **Manage** (your domain) → **Advanced DNS**:

1. Delete the existing *CNAME www* and *URL Redirect / parking* records.
2. Add two records:

| Type     | Host | Value          | TTL       |
|----------|------|----------------|-----------|
| A Record | `@`  | YOUR_SERVER_IP | Automatic |
| A Record | `www`| YOUR_SERVER_IP | Automatic |

3. Save. It usually works within 5–30 minutes (sometimes up to a few hours).
   Check from PowerShell: `nslookup yourdomain.com` should show your server IP.

## Part 5 — Free HTTPS

Once `nslookup` shows your IP, run on the server:

```bash
certbot --nginx -d yourdomain.com -d www.yourdomain.com --redirect
```

Enter an email and agree to the terms. Done: **https://yourdomain.com** works,
and the certificate auto-renews.

---

## Part 6 — Finish

1. Add API keys:
   ```bash
   nano /opt/stayed/StayEd_Backend/.env      # fill OPENAI_API_KEY, SMTP_* (Brevo)
   systemctl restart stayed
   ```
   (Ctrl+O, Enter to save; Ctrl+X to exit nano.)
   In Brevo, verify the sender, and ideally add the DNS records Brevo shows for your
   domain in Namecheap Advanced DNS so emails don't land in spam.
2. Log in as **admin@stayed.com / 12345678** and **change the password immediately**.
   The demo teacher accounts also use `12345678`. Change or delete them before real use.

---

## Everyday commands

| What | Command |
|------|---------|
| Backend status | `systemctl status stayed` |
| Backend logs (live) | `journalctl -u stayed -f` |
| Restart after editing `.env` | `systemctl restart stayed` |
| nginx error log | `tail -f /var/log/nginx/error.log` |
| Database shell | `sudo -u postgres psql stayed_db` |
| Back up the database | `sudo -u postgres pg_dump stayed_db > ~/stayed_$(date +%F).sql` |

## Updating the site after code changes

1. Make a new zip on your PC (exclude `.git`, `.venv`, `node_modules`, `design`, `.env`).
2. Upload and re-run:
   ```bash
   rm -rf /root/stayed && unzip StayEd_deploy.zip -d /root/stayed
   cd /root/stayed/StayEd && bash deploy/setup_server.sh yourdomain.com
   ```
   Re-running keeps your `.env`, database, and trained model.
3. **New SQL migration files are not auto-applied on the server.** Apply each new one once:
   ```bash
   cd /opt/stayed/StayEd_Backend
   sudo -u stayed bash -c 'set -a; . ./.env; psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f sql/37_your_new_file.sql'
   ```
   Never run `00_core_schema.sql` on the live server. It wipes the tables.

## Troubleshooting

- **502 Bad Gateway**: the backend is down. Run `journalctl -u stayed -n 80`.
- **Login page loads but login fails**: open the browser DevTools → Network tab and look at
  the `/api/...` request, then check the backend logs.
- **certbot fails**: DNS isn't pointing at the server yet. Wait, then check `nslookup` again.
- **Out of memory during pip install**: check that swap is on (`swapon --show`), or resize
  the plan in Vultr (Settings → Change Plan).
