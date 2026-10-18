"""One contact-number rule everywhere: 11 digits starting with 09."""
import pytest

from app.helpers import clean_contact_number


@pytest.mark.parametrize("raw", ["09171234567", "+63 917 123 4567", "0917-123-4567", "639171234567", "(0917) 123.4567"])
def test_accepted_forms_are_stored_as_11_digits(raw):
    assert clean_contact_number(raw) == "09171234567"


@pytest.mark.parametrize("raw", ["+1 202 555 0100", "0917123456", "091712345678", "0917abc4567", "12345678901"])
def test_everything_else_is_rejected(raw):
    with pytest.raises(ValueError, match="11 digits starting with 09"):
        clean_contact_number(raw, "Phone number")


@pytest.mark.parametrize("raw", [None, "", "   "])
def test_blank_is_allowed(raw):
    assert clean_contact_number(raw) is None
