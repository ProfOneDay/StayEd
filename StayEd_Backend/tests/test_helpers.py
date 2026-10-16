from app.helpers import title_enum


def test_title_enum_known_values():
    # These are the labels every page is expected to agree on -- a route
    # that keeps its own local copy of one of these instead of calling
    # title_enum() is exactly how the BLP/Basic Literacy and "Basic
    # Literacy Program" inconsistency happened.
    assert title_enum("BLP") == "Basic Literacy"
    assert title_enum("ELEMENTARY") == "Elementary"
    assert title_enum("JUNIOR_HIGH_SCHOOL") == "Junior High"
    assert title_enum("SENIOR_HIGH_SCHOOL") == "Senior High"
    assert title_enum("FACE_TO_FACE") == "Face-to-Face"
    assert title_enum("MODULAR") == "Modular"
    assert title_enum("BLENDED") == "Blended"
    assert title_enum("HIGH") == "High"
    assert title_enum("MODERATE") == "Moderate"
    assert title_enum("LOW") == "Low"
    assert title_enum("ENROLLED") == "Active"
    assert title_enum("WITHDRAWN") == "Archived"
    assert title_enum("DROPPED") == "Inactive"
    assert title_enum("COMPLETED") == "Completed"


def test_title_enum_empty_input():
    assert title_enum(None) == ""
    assert title_enum("") == ""


def test_title_enum_unknown_value_falls_back_to_title_case():
    # A new enum value added to the DB without a matching entry here should
    # degrade to a readable label instead of crashing or showing the raw
    # SCREAMING_SNAKE_CASE value to a user.
    assert title_enum("SOME_NEW_STATUS") == "Some New Status"
