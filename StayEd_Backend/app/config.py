import os
from datetime import timedelta


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "stayed-dev-secret")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "stayed-dev-jwt-secret")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=12)
    DATABASE_URL = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres@127.0.0.1:5433/stayed_db",
    )
    FRONTEND_ORIGINS = [
        item.strip()
        for item in os.getenv(
            "FRONTEND_ORIGINS",
            "http://127.0.0.1:5500,http://localhost:5500,http://127.0.0.1:8000,http://localhost:8000",
        ).split(",")
        if item.strip()
    ]
    MAX_CONTENT_LENGTH = 5 * 1024 * 1024
    MODEL_COMMAND = os.getenv("MODEL_COMMAND", "").strip()

    # Number of reverse-proxy hops in front of this app that are trusted to
    # set X-Forwarded-For/X-Forwarded-Proto honestly (Render, or a VPS with
    # nginx in front of gunicorn, are both exactly one hop). 0 (the default,
    # correct for local dev with no proxy) means request.remote_addr is used
    # as-is -- trusting a hop that doesn't exist would let any visitor spoof
    # their own IP via that header, which is why this isn't just always on.
    TRUSTED_PROXY_COUNT = int(os.getenv("TRUSTED_PROXY_COUNT", "0"))

    SMTP_HOST = os.getenv("SMTP_HOST", "smtp-relay.brevo.com")
    SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USERNAME = os.getenv("SMTP_USERNAME", "").strip()
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "").strip()
    SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", "").strip() or SMTP_USERNAME
    SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "StayEd")
