from app.helpers import title_enum
from app.routes.class_routes import _shape


def _row(learning_level):
    return {
        "class_id": 1,
        "clc_name": "Sample CLC",
        "municipality": "Urdaneta",
        "school_year": "2026-2027",
        "semester": "FIRST",
        "learning_level": learning_level,
        "class_name": "A",
        "status": "active",
    }


def test_learning_level_label_matches_the_shared_helper():
    # class_routes.py used to keep its own "BLP" -> "Basic Literacy Program"
    # map here, which disagreed with every other page's "Basic Literacy".
    # Asserting against title_enum() directly (rather than a hardcoded
    # string) means this stays correct even if the canonical wording in
    # title_enum ever changes.
    for level in ("BLP", "ELEMENTARY", "JUNIOR_HIGH_SCHOOL", "SENIOR_HIGH_SCHOOL"):
        shaped = _shape(_row(level))
        assert shaped["learningLevel"] == title_enum(level)


def test_learning_level_label_is_not_the_old_duplicate_wording():
    shaped = _shape(_row("BLP"))
    assert shaped["learningLevel"] == "Basic Literacy"
    assert shaped["learningLevel"] != "Basic Literacy Program"
