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

    SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USERNAME = os.getenv("SMTP_USERNAME", "").strip()
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "").strip()
    SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", "").strip() or SMTP_USERNAME
    SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "StayEd")
