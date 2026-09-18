"""Checks a self-registering teacher's typed name against the division's
official ALS Teachers roster (als_teacher_roster, seeded from
LIST_OF_ALS_TEACHERS.csv by sql/22_als_teacher_roster.sql).

Per the panel's requirement, registration must auto-reject anyone not on
that list. Matching is deliberately lenient about formatting -- the roster
spells each name one specific way (e.g. "Ma. Teresa T. Libao") but a teacher
types their own name freely at registration -- so this compares normalized
name *tokens* rather than exact strings: case/punctuation/accents are
stripped, single-letter middle initials are ignored, and word order doesn't
matter. It still requires every core token from the roster entry (first
name(s) + last name) to appear in what was typed, so an unrelated name won't
accidentally match.
"""
from __future__ import annotations

import re
import unicodedata

from ..db import fetch_all

_SUFFIXES = {"jr", "sr", "ii", "iii", "iv", "v"}

# "Ma." is a very common Filipino name prefix (short for "Maria") that a
# teacher may reasonably spell out in full when typing their own name.
_TOKEN_EQUIVALENTS = {"ma": {"ma", "maria"}}


def _normalize_tokens(name: str) -> set[str]:
    decomposed = unicodedata.normalize("NFKD", name or "")
    ascii_name = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    cleaned = re.sub(r"[^a-zA-Z\s]", " ", ascii_name).lower()
    tokens = [t for t in cleaned.split() if t]
    return {t for t in tokens if len(t) > 1 and t not in _SUFFIXES}


def _token_satisfied(token: str, submitted_tokens: set[str]) -> bool:
    return bool(_TOKEN_EQUIVALENTS.get(token, {token}) & submitted_tokens)


def is_on_teacher_roster(full_name: str) -> bool:
    submitted_tokens = _normalize_tokens(full_name)
    if not submitted_tokens:
        return False

    for row in fetch_all("SELECT full_name FROM als_teacher_roster"):
        roster_tokens = _normalize_tokens(row["full_name"])
        if roster_tokens and all(_token_satisfied(t, submitted_tokens) for t in roster_tokens):
            return True

    return False
