"""Names typed into separate First / Middle / Surname fields must be saved
exactly as entered -- never re-split (the "Juan Carlos Reyes" bug)."""
import pytest

from app.helpers import display_name, name_parts, split_name
from app.routes.learner_routes import _validate_learner_payload


def test_two_given_names_stay_in_first_name():
    assert name_parts({"first_name": "Juan Carlos", "middle_name": "", "last_name": "Reyes"}) == (
        "Juan Carlos", None, "Reyes",
    )


def test_compound_surname_and_camel_case_keys():
    assert name_parts({"firstName": " Maria  Clara ", "middleName": "Santos", "lastName": "Dela Cruz"}) == (
        "Maria Clara", "Santos", "Dela Cruz",
    )


def test_no_name_fields_means_fallback():
    assert name_parts({"name": "Juan Reyes"}) is None


def test_learner_payload_uses_separate_fields():
    clean = _validate_learner_payload(
        {"first_name": "Juan Carlos", "last_name": "Reyes", "lrn": "123456789012", "sex": "Male",
         "birthdate": "2005-01-02", "civil_status": "Single", "occupation": "Other", "address": "Brgy. Bari"},
    )
    assert (clean["first_name"], clean["middle_name"], clean["last_name"]) == ("Juan Carlos", None, "Reyes")


def test_partial_update_can_fix_just_the_name():
    clean = _validate_learner_payload({"first_name": "Juan Carlos", "last_name": "Reyes"}, partial=True)
    assert clean == {"first_name": "Juan Carlos", "last_name": "Reyes"}


def test_missing_surname_is_rejected():
    with pytest.raises(ValueError, match="surname"):
        _validate_learner_payload({"first_name": "Juan", "last_name": ""}, partial=True)


def test_comma_format_still_works_for_old_single_box():
    assert split_name("Reyes, Juan Carlos") == ("Juan Carlos", "Reyes")


def test_display_name_uses_middle_initial():
    assert display_name("Juan Carlos", "Dizon", "Reyes") == "Juan Carlos D. Reyes"
    assert display_name("Juan Carlos", None, "Reyes") == "Juan Carlos Reyes"
