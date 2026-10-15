from __future__ import annotations

import smtplib
from email.message import EmailMessage
from html import escape

from flask import current_app


def send_email(to: str, subject: str, body: str, html: str | None = None) -> bool:
    """Send an email via the configured SMTP account (Brevo's SMTP
    relay by default -- smtp-relay.brevo.com -- rather than a personal Gmail
    account, since transactional mail like approval notices needs a sending
    reputation Gmail's consumer SMTP isn't built for). SMTP_USERNAME/
    SMTP_PASSWORD are the "SMTP login" and generated SMTP key from Brevo's
    dashboard (Senders, Domains & Dedicated IPs -> SMTP & API -> SMTP tab),
    NOT your Brevo account password. SMTP_FROM_EMAIL must be a sender address
    verified in that same Brevo account, or sends will fail even with valid
    credentials.

    `body` is always sent as the plain-text part; pass `html` (see
    render_email) to add a branded HTML alternative that mail apps prefer
    when they can display it.

    Returns False (and logs) instead of raising on any failure, so a broken/
    unconfigured mail setup never blocks the action that triggered it (e.g.
    approving a teacher account still succeeds even if the email can't be
    sent).
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
    if html:
        message.add_alternative(html, subtype="html")

    try:
        with smtplib.SMTP(config.get("SMTP_HOST", "smtp-relay.brevo.com"), config.get("SMTP_PORT", 587)) as smtp:
            smtp.starttls()
            smtp.login(username, password)
            smtp.send_message(message)
        return True
    except Exception:
        current_app.logger.exception("Failed to send email to %s", to)
        return False


# Brand colors, matching the app's CSS tokens (--st-primary, --st-risk-*).
_NAVY = "#12355b"
ACCENT_SUCCESS = "#6bbf59"
ACCENT_WARNING = "#f39422"


def render_email(
    heading: str,
    greeting_name: str,
    paragraphs: list[str],
    accent: str = ACCENT_SUCCESS,
    callout: tuple[str, str] | None = None,
    button: tuple[str, str] | None = None,
    closing: list[str] | None = None,
) -> str:
    """Build the branded HTML version of a notification email: navy header
    with the StayEd logo, a colored accent line, then the message. Every
    piece of text is HTML-escaped here, so callers pass plain strings
    (names, rejection reasons, etc.) as-is.

    Uses table layout and inline styles only -- Gmail/Outlook strip <style>
    blocks and most modern CSS. The logo loads from PUBLIC_SITE_URL, so it
    may stay hidden until the reader allows images; the "StayEd" text next
    to it keeps the header readable either way.

    `callout` is an optional (label, text) box, e.g. ("Reason", "...").
    `button` is an optional (label, url) link button.
    `closing` paragraphs come after the callout/button.
    """
    site = current_app.config.get("PUBLIC_SITE_URL", "https://stay-ed.site")
    logo = f"{site}/assets/img/brand/logo-white.png"
    p_style = "margin:0 0 16px"

    body_html = "".join(f'<p style="{p_style}">{escape(p)}</p>' for p in paragraphs)
    if callout:
        label, text = callout
        body_html += (
            '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px"><tr>'
            f'<td style="background:#fff6ec;border-left:4px solid {accent};padding:12px 16px;border-radius:4px;font-size:14px">'
            f'<b style="color:#8a4b00">{escape(label)}</b><br>{escape(text).replace(chr(10), "<br>")}'
            "</td></tr></table>"
        )
    if button:
        label, url = button
        body_html += (
            f'<p style="margin:8px 0 24px"><a href="{escape(url, quote=True)}" '
            f'style="display:inline-block;background:{_NAVY};color:#ffffff;text-decoration:none;'
            f'font-weight:bold;padding:12px 22px;border-radius:8px">{escape(label)}</a></p>'
        )
    body_html += "".join(f'<p style="{p_style}">{escape(p)}</p>' for p in closing or [])

    greeting = f"Hi {greeting_name}," if greeting_name else "Hi,"
    return f"""<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px 12px;background:#f6f8fc;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e3e7ee;border-radius:12px;overflow:hidden;border-collapse:separate">
  <tr><td style="background:{_NAVY};padding:18px 24px">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td><img src="{escape(logo, quote=True)}" width="36" height="36" alt="" style="display:block;border:0"></td>
      <td style="padding-left:10px;color:#ffffff;font-size:22px;font-weight:bold;font-family:Arial,Helvetica,sans-serif">StayEd</td>
    </tr></table>
  </td></tr>
  <tr><td style="height:4px;background:{accent};font-size:0;line-height:0">&nbsp;</td></tr>
  <tr><td style="padding:28px 24px 8px;font-size:15px;line-height:1.6;color:#1f2a3d">
    <p style="margin:0 0 6px;font-size:20px;font-weight:bold;color:{_NAVY}">{escape(heading)}</p>
    <p style="{p_style}">{escape(greeting)}</p>
    {body_html}
  </td></tr>
  <tr><td style="padding:16px 24px;background:#f5f7fa;font-size:12px;color:#6b7385;line-height:1.5;border-top:1px solid #e3e7ee">
    StayEd &middot; Alternative Learning System, Schools Division of Pangasinan II<br>
    This is an automated message. Please don&#39;t reply to this email.
  </td></tr>
</table>
</body></html>"""
