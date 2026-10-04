"""Checks a self-registering teacher's typed name against the division's
official ALS Teachers roster (als_teacher_roster, seeded from
LIST_OF_ALS_TEACHERS.csv by sql/22_als_teacher_roster.sql), and resolves
their roster-listed station school to a real clc row (seeded from the same
CSV by sql/31_seed_division_ii_clcs.sql) so registration can auto-assign it.

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

from ..db import fetch_all, fetch_one

_SUFFIXES = {"jr", "sr", "ii", "iii", "iv", "v"}

# "Ma." is a very common Filipino name prefix (short for "Maria") that a
# teacher may reasonably spell out in full when typing their own name.
_TOKEN_EQUIVALENTS = {"ma": {"ma", "maria"}}

# als_district on the roster is really "<municipality> <cluster number>"
# (e.g. "Manaoag I", "Villasis II") or a program name ("BPOSA-Mangaldan"),
# not the plain municipality clc.municipality stores -- this is the same
# normalization used to verify the roster import (see 31_seed_division_ii_clcs.sql
# and its cross-check against LIST_OF_ALS_TEACHERS.csv).
_DISTRICT_CLUSTER_RE = re.compile(r"\s+(I{1,3}|IV)$")
_DISTRICT_MUNICIPALITY_FIX = {
    "sta. maria": "Santa Maria",
    "sto. tomas": "Santo Tomas",
    "pozorrobio": "Pozorrubio",
    "bposa-mangaldan": "Mangaldan",
}


def _normalize_tokens(name: str) -> set[str]:
    decomposed = unicodedata.normalize("NFKD", name or "")
    ascii_name = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    cleaned = re.sub(r"[^a-zA-Z\s]", " ", ascii_name).lower()
    tokens = [t for t in cleaned.split() if t]
    return {t for t in tokens if len(t) > 1 and t not in _SUFFIXES}


def _token_satisfied(token: str, submitted_tokens: set[str]) -> bool:
    return bool(_TOKEN_EQUIVALENTS.get(token, {token}) & submitted_tokens)


def _match_roster_row(full_name: str) -> dict | None:
    submitted_tokens = _normalize_tokens(full_name)
    if not submitted_tokens:
        return None

    for row in fetch_all("SELECT full_name, als_district, station_school FROM als_teacher_roster"):
        roster_tokens = _normalize_tokens(row["full_name"])
        if roster_tokens and all(_token_satisfied(t, submitted_tokens) for t in roster_tokens):
            return row

    return None


def _district_to_municipality(als_district: str) -> str:
    stripped = _DISTRICT_CLUSTER_RE.sub("", (als_district or "").strip())
    return _DISTRICT_MUNICIPALITY_FIX.get(stripped.lower(), stripped)


def is_on_teacher_roster(full_name: str) -> bool:
    return _match_roster_row(full_name) is not None


def find_roster_assignment(full_name: str) -> dict | None:
    """What the roster says about a teacher's municipality and CLC.

    Returns None if the name isn't on the roster. Otherwise returns
    {"municipality": ..., "clc_id": ..., "clc_name": ...}, where municipality
    comes from the roster's ALS district and is filled whenever the district
    is, and clc_id/clc_name are None unless the station school matches an
    active clc row in that municipality. A roster match with no CLC match
    still gives the admin the municipality to start from.
    """
    row = _match_roster_row(full_name)
    if not row:
        return None

    municipality = _district_to_municipality(row.get("als_district") or "") or None
    clc = None
    if municipality and row.get("station_school"):
        clc = fetch_one(
            "SELECT clc_id, clc_name FROM clc WHERE LOWER(BTRIM(clc_name)) = LOWER(BTRIM(%s)) "
            "AND LOWER(BTRIM(municipality)) = LOWER(BTRIM(%s)) AND status = 'ACTIVE' LIMIT 1",
            (row["station_school"], municipality),
        )

    return {
        "municipality": municipality,
        "clc_id": clc["clc_id"] if clc else None,
        "clc_name": clc["clc_name"] if clc else None,
    }
