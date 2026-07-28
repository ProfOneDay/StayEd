from __future__ import annotations

from flask import current_app, g
import psycopg
from psycopg.rows import dict_row


def get_db() -> psycopg.Connection:
    if "db" not in g:
        g.db = psycopg.connect(
            current_app.config["DATABASE_URL"],
            row_factory=dict_row,
        )
    return g.db


def close_db(_error=None) -> None:
    db = g.pop("db", None)
    if db is not None:
        db.close()


def fetch_one(query: str, params: tuple | list = ()):
    with get_db().cursor() as cur:
        cur.execute(query, params)
        return cur.fetchone()


def fetch_all(query: str, params: tuple | list = ()):
    with get_db().cursor() as cur:
        cur.execute(query, params)
        return cur.fetchall()


def execute(query: str, params: tuple | list = (), *, returning: bool = False):
    db = get_db()
    try:
        with db.cursor() as cur:
            cur.execute(query, params)
            result = cur.fetchone() if returning else None
        db.commit()
        return result
    except Exception:
        db.rollback()
        raise


def init_app(app) -> None:
    app.teardown_appcontext(close_db)
