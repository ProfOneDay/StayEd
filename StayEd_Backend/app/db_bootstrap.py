"""Local-dev database bootstrap.

Ensures the Dockerized Postgres server StayEd expects (see StayEd_Backend/step.txt)
exists, is running, and has the StayEd schema applied. Runs automatically from
run.py on every backend start; safe to re-run because it only ever applies the
SQL scripts once - if the `users` table already exists it skips straight
through. This matters because sql/00_core_schema.sql opens with
`DROP TABLE ... CASCADE`; re-applying it against a populated database would
destroy existing data, so that step must never run unconditionally.

Disable entirely by setting AUTO_PROVISION_DB=0 in .env.
"""

from __future__ import annotations

import os
import subprocess
import time
from pathlib import Path
from urllib.parse import urlparse

import psycopg

SQL_DIR = Path(__file__).resolve().parent.parent / "sql"
CONTAINER_NAME = os.getenv("DB_CONTAINER_NAME", "stayed-postgres")
DOCKER_IMAGE = os.getenv("DB_DOCKER_IMAGE", "postgres:16")


def _log(message: str) -> None:
    print(f"[db-bootstrap] {message}")


def _parsed_db() -> dict:
    url = os.getenv("DATABASE_URL", "postgresql://postgres@127.0.0.1:5433/stayed_db")
    parsed = urlparse(url)
    return {
        "user": parsed.username or "postgres",
        "password": parsed.password or "",
        "host": parsed.hostname or "127.0.0.1",
        "port": parsed.port or 5432,
        "dbname": (parsed.path or "/stayed_db").lstrip("/"),
    }


def _docker_available() -> bool:
    try:
        subprocess.run(["docker", "version"], capture_output=True, timeout=5, check=True)
        return True
    except Exception:
        return False


def _container_status(name: str) -> str | None:
    result = subprocess.run(
        ["docker", "inspect", "-f", "{{.State.Status}}", name],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        return None
    return result.stdout.strip()


def _ensure_container(cfg: dict) -> None:
    status = _container_status(CONTAINER_NAME)
    if status is None:
        _log(
            f"Creating Docker container '{CONTAINER_NAME}' ({DOCKER_IMAGE}) - "
            "first run may take a minute while the image downloads..."
        )
        subprocess.run(
            [
                "docker", "run", "--name", CONTAINER_NAME,
                "-e", f"POSTGRES_USER={cfg['user']}",
                "-e", f"POSTGRES_PASSWORD={cfg['password']}",
                "-e", f"POSTGRES_DB={cfg['dbname']}",
                "-p", f"{cfg['port']}:5432",
                "-d", DOCKER_IMAGE,
            ],
            check=True,
        )
    elif status != "running":
        _log(f"Starting existing container '{CONTAINER_NAME}'...")
        subprocess.run(["docker", "start", CONTAINER_NAME], check=True, capture_output=True)
    else:
        _log(f"Container '{CONTAINER_NAME}' already running.")


def _wait_until_ready(cfg: dict, attempts: int = 60, delay: float = 2.0) -> bool:
    for attempt in range(1, attempts + 1):
        result = subprocess.run(
            ["docker", "exec", CONTAINER_NAME, "pg_isready", "-U", cfg["user"]],
            capture_output=True,
        )
        if result.returncode == 0:
            return True
        if attempt % 10 == 0:
            _log(f"Still waiting for Postgres to accept connections ({attempt * delay:.0f}s)...")
        time.sleep(delay)
    return False


def _core_tables_exist(cfg: dict) -> bool:
    with psycopg.connect(
        host=cfg["host"], port=cfg["port"], dbname=cfg["dbname"],
        user=cfg["user"], password=cfg["password"], connect_timeout=5,
    ) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT to_regclass('public.users')")
            return cur.fetchone()[0] is not None


def _apply_sql_file(path: Path) -> None:
    _log(f"Applying {path.name}...")
    with path.open("rb") as fh:
        result = subprocess.run(
            [
                "docker", "exec", "-i", CONTAINER_NAME,
                "psql", "-U", "postgres", "-d", "stayed_db", "-v", "ON_ERROR_STOP=1",
            ],
            stdin=fh,
            capture_output=True,
        )
    if result.returncode != 0:
        raise RuntimeError(
            f"{path.name} failed:\n{result.stderr.decode(errors='replace')}"
        )


def ensure_database_ready() -> None:
    """Best-effort local dev bootstrap. Never raises - a failure here should not
    prevent the Flask app from starting; it just means the developer has to set
    the database up manually (see StayEd_Backend/sql/README-equivalent notes)."""
    if os.getenv("AUTO_PROVISION_DB", "1") != "1":
        return

    cfg = _parsed_db()
    if cfg["host"] not in ("127.0.0.1", "localhost"):
        _log(f"DATABASE_URL points at '{cfg['host']}', not localhost - skipping auto setup.")
        return

    if not _docker_available():
        _log(
            "Docker isn't available or the Docker daemon isn't running - skipping auto setup. "
            "Start Docker Desktop, or apply StayEd_Backend/sql/*.sql manually."
        )
        return

    try:
        _ensure_container(cfg)

        if not _wait_until_ready(cfg):
            _log("Postgres didn't become ready in time - the app may fail to connect.")
            return

        sql_files = sorted(SQL_DIR.glob("*.sql"))

        if _core_tables_exist(cfg):
            # 00_core_schema.sql opens with DROP TABLE ... CASCADE - never
            # re-run it once the core tables exist. Every other script is
            # written with IF NOT EXISTS / WHERE NOT EXISTS guards, so it's
            # safe (and desirable) to re-apply them on every start: that's
            # how newly added migration files, like the CLC profile columns,
            # reach a database that was already set up before they existed.
            pending = [f for f in sql_files if f.name != "00_core_schema.sql"]
            if not pending:
                _log("Database schema is up to date.")
                return
            _log("Core schema already present - applying any newer migrations...")
            for sql_file in pending:
                _apply_sql_file(sql_file)
            _log("Database is up to date.")
            return

        _log("Fresh database detected - applying StayEd schema (00 -> 01 -> 02 -> ...)...")
        for sql_file in sql_files:
            _apply_sql_file(sql_file)
        _log("Schema setup complete.")
    except Exception as exc:
        _log(f"Auto setup failed: {exc}")
        _log("You can still set up manually - see StayEd_Backend/sql/.")


if __name__ == "__main__":
    from dotenv import load_dotenv

    load_dotenv()
    ensure_database_ready()