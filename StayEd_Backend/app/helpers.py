from __future__ import annotations

import re
from datetime import date, datetime
from decimal import Decimal
from typing import Any
from zoneinfo import ZoneInfo

from flask import jsonify


_PH_TZ = ZoneInfo("Asia/Manila")


def today_ph() -> date:
    """"Today" in the Philippines, regardless of the server's own clock/
    timezone. Use this everywhere a backend check means "today" for a
    teacher -- the server clock can be in UTC, where it's still yesterday
    in Manila until 8 AM."""
    return datetime.now(_PH_TZ).date()


LRN_RE = re.compile(r"^\d{12}$")
# Philippine mobile number: 11 digits starting with 09 (e.g. 09171234567).
CONTACT_NUMBER_RE = re.compile(r"^09\d{9}$")

# Standard learner-intake values. These are the ONLY accepted values for
# their fields -- the Excel import template's dropdowns, the import
# validation, the enroll wizard and the profile edit modal all draw from
# these lists, so a learner can never be saved as "single" in one place and
# "Single" or "S" in another.
SEX_OPTIONS = ("Male", "Female")
CIVIL_STATUS_OPTIONS = ("Single", "Married", "Widowed", "Separated")
MODALITY_OPTIONS = ("Face-to-Face", "Modular", "Blended")
YES_NO_OPTIONS = ("Yes", "No")
EMPLOYMENT_STATUS_OPTIONS = ("Employed", "Unemployed")
SOCIO_ECONOMIC_OPTIONS = (
    "Unemployed / No Income",
    "Informal / Contractual Worker",
    "Formal Employment",
    "Self-Employed / Business Owner",
    "OFW (Overseas Filipino Worker)",
    "Retired / Pensioner",
    "Other",
)

LEARNER_FIELD_OPTIONS = {
    "sex": SEX_OPTIONS,
    "civil_status": CIVIL_STATUS_OPTIONS,
    "modality": MODALITY_OPTIONS,
    "re_enrollee": YES_NO_OPTIONS,
    "employment_status": EMPLOYMENT_STATUS_OPTIONS,
    "occupation": SOCIO_ECONOMIC_OPTIONS,
}


def _normalise_key(text) -> str:
    # "face to face" and "Face-to-Face" count as the same answer.
    return " ".join(str(text or "").replace("-", " ").split()).lower()


def match_option(value, options) -> str | None:
    """Return the standard spelling of `value` from `options` (matched
    case-insensitively, ignoring extra spaces), or None when it isn't one
    of them."""
    wanted = _normalise_key(value)
    if not wanted:
        return None
    for option in options:
        if _normalise_key(option) == wanted:
            return option
    return None


def natural_option_list(options) -> str:
    """"Employed or Unemployed" / "Face-to-Face, Modular or Blended" --
    a plain-English list for a teacher-facing message, not a code dump."""
    options = list(options)
    if len(options) <= 1:
        return options[0] if options else ""
    return ", ".join(options[:-1]) + " or " + options[-1]


# Spellings of "self-employed" the Employment Status column should still
# accept, saved as "Employed" (EMPLOYMENT_STATUS_OPTIONS has no third value
# for it -- the detail belongs in Socio-economic Status instead). Keys are
# pre-normalised with _normalise_key so lookups don't need to re-derive it.
EMPLOYMENT_ALIASES = {
    "self employed": "Employed",
    "selfemployed": "Employed",
    "self employed / business owner": "Employed",
}


def resolve_employment_alias(value) -> str | None:
    """Canonical Employment Status for a Self-employed-family spelling
    (see EMPLOYMENT_ALIASES), or None when `value` isn't one of them."""
    return EMPLOYMENT_ALIASES.get(_normalise_key(value))


# Modality spellings beyond what match_option's case/hyphen/space folding
# already covers.
_MODALITY_ALIASES = {"f2f": "Face-to-Face"}


def resolve_modality_alias(value) -> str | None:
    return _MODALITY_ALIASES.get(_normalise_key(value))


def strict_modality(value) -> str | None:
    """The database enum for a clean MODALITY_OPTIONS value (friendly
    aliases included), or None for anything else -- including blank.
    Unlike enum_modality(), this never guesses a default: the caller
    (an import insert path) must treat None as "skip this row", not
    "assume Face-to-Face"."""
    text = resolve_modality_alias(value) or value
    match = match_option(text, MODALITY_OPTIONS)
    if not match:
        return None
    return {"Face-to-Face": "FACE_TO_FACE", "Modular": "MODULAR", "Blended": "BLENDED"}[match]


def strict_yes_no(value) -> bool | None:
    """True/False for a clean Yes/No (plus the existing Y/N, true/false,
    1/0 aliases), or None for a blank cell or anything else not on that
    list. Blank vs. "something unrecognised" are both None here on
    purpose -- the caller decides what blank means (today, No)."""
    text = str(value or "").strip().lower()
    if not text:
        return None
    if text in {"y", "yes", "true", "1"}:
        return True
    if text in {"n", "no", "false", "0"}:
        return False
    return None


def normalise_contact_number(value) -> str | None:
    """Strip spaces/dashes and restore the leading 0 Excel drops from a
    number-formatted cell (9171234567 -> 09171234567). Returns None for a
    blank value; the caller checks the result against CONTACT_NUMBER_RE."""
    text = str(value or "").strip()
    if text.endswith(".0"):
        text = text[:-2]
    text = re.sub(r"[\s\-().]", "", text)
    if not text:
        return None
    # International forms of a PH mobile number -> the 11-digit local form.
    if text.startswith("+63"):
        text = "0" + text[3:]
    elif len(text) == 12 and text.startswith("63"):
        text = "0" + text[2:]
    elif len(text) == 10 and text.startswith("9"):
        text = "0" + text
    return text


def clean_contact_number(value, label: str = "Contact number") -> str | None:
    """The one contact-number rule for every form: blank is allowed (None),
    anything else must end up as 11 digits starting with 09 -- no "+", no
    letters. "+63 917 123 4567" / "0917-123-4567" are accepted and stored
    as "09171234567". Raises ValueError with a user-facing message.
    The database enforces the same shape (sql/39_contact_number_digits.sql)."""
    number = normalise_contact_number(value)
    if number and not CONTACT_NUMBER_RE.match(number):
        raise ValueError(f"{label} must be 11 digits starting with 09 (e.g. 09171234567).")
    return number
# Official DepEd employee number: exactly 7 digits.
EMPLOYEE_ID_RE = re.compile(r"^\d{7}$")
EMPLOYEE_ID_ERROR = "Employee ID must be exactly 7 digits (official DepEd employee number)."
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


_NAME_PART_KEYS = {
    "first": ("first_name", "firstName"),
    "middle": ("middle_name", "middleName"),
    "last": ("last_name", "lastName"),
}


def name_parts(data: dict) -> tuple[str, str | None, str] | None:
    """(first, middle, last) from separate First/Middle/Last name fields,
    or None when the payload has none of them (callers then fall back to
    split_name() on a single full-name string).

    Separate fields are the reliable path: a single "Juan Carlos Reyes"
    box can't tell two given names from a two-word surname (split_name
    would save the surname as "Carlos Reyes"). Values are only trimmed --
    never re-split -- and capped at the 100-char column width."""
    if not any(k in data for keys in _NAME_PART_KEYS.values() for k in keys):
        return None

    def pick(part: str) -> str:
        for key in _NAME_PART_KEYS[part]:
            if key in data:
                return " ".join(str(data[key] or "").split())[:100]
        return ""

    return pick("first"), pick("middle") or None, pick("last")


def display_name(first: str | None, middle: str | None, last: str | None) -> str:
    """"First M. Last" -- the middle name shown as an initial, the usual
    DepEd/ALS form convention."""
    initial = f"{middle.strip()[0].upper()}." if middle and middle.strip() else ""
    return " ".join(p for p in (first or "", initial, last or "") if p).strip()


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


# Plain-English messages for the CHECK constraints a teacher's own input
# can realistically trip (sql/00_core_schema.sql and friends) -- so the
# global CheckViolation handler (app/__init__.py) never has to fall back
# to the raw PostgreSQL constraint text for these. Anything not listed
# here gets the generic fallback message instead.
CONSTRAINT_MESSAGES = {
    "ck_intervention_dates": "The follow-up date can't be earlier than the day the intervention was assigned.",
    "ck_module_record_dates": "The return date can't be earlier than the release date.",
    "ck_class_enrollment_distance": "Distance from CLC can't be negative.",
    "ck_learner_date_of_birth": "Please enter a valid date of birth.",
    "ck_risk_monitoring_dates": "The monitoring end date can't be earlier than the start date.",
    "ck_users_contact_number": "Contact number must be 11 digits starting with 09 (e.g. 09171234567).",
    "ck_teacher_contact_number": "Contact number must be 11 digits starting with 09 (e.g. 09171234567).",
    "ck_learner_contact_number": "Contact number must be 11 digits starting with 09 (e.g. 09171234567).",
    "ck_learner_guardian_contact_number": "Guardian contact number must be 11 digits starting with 09 (e.g. 09171234567).",
    "ck_clc_contact_number": "Contact number must be 11 digits starting with 09 (e.g. 09171234567).",
}

GENERIC_CONSTRAINT_MESSAGE = "Some of the information entered is not allowed. Please check it and try again."


def constraint_message(constraint_name: str | None) -> str:
    return CONSTRAINT_MESSAGES.get(constraint_name or "", GENERIC_CONSTRAINT_MESSAGE)


def enum_semester(value: str | None) -> str:
    v = str(value or "").strip().lower()
    if "second" in v:
        return "SECOND"
    if "third" in v or "summer" in v:
        return "SUMMER"
    if "whole" in v:
        return "WHOLE_YEAR"
    return "FIRST"
