from __future__ import annotations

import smtplib
from email.message import EmailMessage

from flask import current_app


def send_email(to: str, subject: str, body: str) -> bool:
    """Send a plain-text email via the configured SMTP account (Gmail SMTP by
    default). Returns False (and logs) instead of raising on any failure, so
    a broken/unconfigured mail setup never blocks the action that triggered
    it (e.g. approving a teacher account still succeeds even if the email
    can't be sent).
    """
    config = current_app.config
    username = config.get("SMTP_USERNAME")
    password = config.get("SMTP_PASSWORD")
    if not username or not password:
        current_app.logger.warning(
            "Email not sent to %s (SMTP_USERNAME/SMTP_PASSWORD not configured): %s",
            to, subject,
        )
        return False

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = f"{config.get('SMTP_FROM_NAME', 'StayEd')} <{config.get('SMTP_FROM_EMAIL') or username}>"
    message["To"] = to
    message.set_content(body)

    try:
        with smtplib.SMTP(config.get("SMTP_HOST", "smtp.gmail.com"), config.get("SMTP_PORT", 587)) as smtp:
            smtp.starttls()
            smtp.login(username, password)
            smtp.send_message(message)
        return True
    except Exception:
        current_app.logger.exception("Failed to send email to %s", to)
        return False
