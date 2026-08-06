from __future__ import annotations

from ..db import execute, fetch_one

DEFAULT_SCHOOL_YEAR = "2026-2027"


def get_active_school_year() -> str:
    row = fetch_one("SELECT setting_value FROM system_setting WHERE setting_key='active_school_year'")
    return row["setting_value"] if row else DEFAULT_SCHOOL_YEAR


def set_active_school_year(value: str, user_id: int) -> str:
    execute(
        """
        INSERT INTO system_setting (setting_key, setting_value, updated_by_user_id)
        VALUES ('active_school_year', %s, %s)
        ON CONFLICT (setting_key) DO UPDATE
            SET setting_value = EXCLUDED.setting_value,
                updated_by_user_id = EXCLUDED.updated_by_user_id,
                updated_at = CURRENT_TIMESTAMP
        """,
        (value, user_id),
    )
    return value
