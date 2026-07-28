from __future__ import annotations

import re
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from flask import jsonify


LRN_RE = re.compile(r"^\d{12}$")


def json_ready(value: Any):
    if isinstance(value, dict):
        return {k: json_ready(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [json_ready(v) for v in value]
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return value


def error(message: str, status: int = 400, **extra):
    payload = {"message": message, **extra}
    return jsonify(payload), status


def split_name(full_name: str) -> tuple[str, str]:
    parts = [p for p in str(full_name or "").strip().split() if p]
    if not parts:
        return "", ""
    if len(parts) == 1:
        return parts[0], "."
    return parts[0], " ".join(parts[1:])


def title_enum(value: str | None) -> str:
    if not value:
        return ""
    mapping = {
        "FACE_TO_FACE": "Face-to-Face",
        "MODULAR": "Modular",
        "BLENDED": "Blended",
        "BLP": "Basic Literacy",
        "ELEMENTARY": "Elementary",
        "JUNIOR_HIGH_SCHOOL": "Junior High",
        "SENIOR_HIGH_SCHOOL": "Senior High",
        "LOW": "Low",
        "MODERATE": "Moderate",
        "HIGH": "High",
        "ENROLLED": "Active",
        "WITHDRAWN": "Archived",
        "DROPPED": "Inactive",
        "COMPLETED": "Completed",
    }
    return mapping.get(value, value.replace("_", " ").title())


def enum_modality(value: str | None) -> str:
    v = str(value or "").strip().lower().replace("-", " ")
    if "modular" in v:
        return "MODULAR"
    if "blend" in v:
        return "BLENDED"
    return "FACE_TO_FACE"


def enum_level(value: str | None) -> str:
    v = str(value or "").strip().lower()
    if "senior" in v:
        return "SENIOR_HIGH_SCHOOL"
    if "junior" in v:
        return "JUNIOR_HIGH_SCHOOL"
    if "elementary" in v:
        return "ELEMENTARY"
    return "BLP"


def enum_semester(value: str | None) -> str:
    v = str(value or "").strip().lower()
    if "second" in v:
        return "SECOND"
    if "third" in v or "summer" in v:
        return "SUMMER"
    if "whole" in v:
        return "WHOLE_YEAR"
    return "FIRST"
