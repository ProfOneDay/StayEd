from __future__ import annotations

import re
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from flask import jsonify


LRN_RE = re.compile(r"^\d{12}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# Official DepEd email domains (or subdomains of them, e.g. region1.deped.gov.ph).
# Registration only requires the name to match the ALS teacher roster -- it does
# NOT require a DepEd email -- so a matched name can still show up here with a
# personal address. The admin review UI uses this to flag that case honestly
# instead of always claiming "DepEd Verified".
_DEPED_EMAIL_DOMAINS = ("deped.gov.ph", "deped.edu.ph")


def is_deped_email(email: str) -> bool:
    domain = str(email or "").strip().lower().rsplit("@", 1)[-1]
    return any(domain == d or domain.endswith("." + d) for d in _DEPED_EMAIL_DOMAINS)


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
    raw = str(full_name or "").strip()
    if not raw:
        return "", ""
    # DepEd forms conventionally ask for "Surname, First Name M.I." -- a
    # comma is an unambiguous signal for that order (plain "First Last"
    # input never contains one), so honor it before falling back to the
    # whitespace-based First-Name-First split every other caller relies on.
    if "," in raw:
        last, _, rest = raw.partition(",")
        last = last.strip()
        first = rest.strip()
        if last and first:
            return first, last
        if last:
            return last, "."
    parts = [p for p in raw.split() if p]
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
