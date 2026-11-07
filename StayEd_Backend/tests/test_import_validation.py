from io import BytesIO

from openpyxl import load_workbook

from app.helpers import (
    CIVIL_STATUS_OPTIONS,
    match_option,
    normalise_contact_number,
    strict_modality,
    strict_yes_no,
)
from app.routes import learner_routes
from app.routes.learner_routes import _check_import_row, _normalise_import_value, _preview_rows
from app.services.import_template import IMPORT_COLUMNS, build_import_template


def _row(**overrides):
    row = {
        "lrn": "123456789012",
        "last_name": "Dela Cruz",
        "first_name": "Juan",
        "sex": "Male",
        "birthdate": "2008-05-14",
        "modality": "Face-to-Face",
        "civil_status": "Single",
        "occupation": "Formal Employment",
    }
    row.update(overrides)
    return row


def test_match_option_returns_the_standard_spelling():
    assert match_option("  single ", CIVIL_STATUS_OPTIONS) == "Single"
    assert match_option("MARRIED", CIVIL_STATUS_OPTIONS) == "Married"
    assert match_option("face to face", ("Face-to-Face",)) == "Face-to-Face"
    assert match_option("singel", CIVIL_STATUS_OPTIONS) is None
    assert match_option("", CIVIL_STATUS_OPTIONS) is None


def test_normalise_contact_number_restores_dropped_leading_zero():
    assert normalise_contact_number("9171234567") == "09171234567"
    assert normalise_contact_number("0917-123-4567") == "09171234567"
    assert normalise_contact_number("+639171234567") == "09171234567"
    assert normalise_contact_number("") is None


def test_complete_row_has_no_issues_and_is_standardised():
    clean, issues, field_issues, field_notes = _check_import_row(
        _row(sex="female", civil_status="married", modality="modular", re_enrollee="y")
    )
    assert issues == []
    assert field_issues == {}
    assert field_notes == {}
    assert clean["sex"] == "Female"
    assert clean["civil_status"] == "Married"
    assert clean["modality"] == "Modular"
    assert clean["re_enrollee"] == "Yes"


def test_civil_status_is_mandatory():
    _, issues, field_issues, _ = _check_import_row(_row(civil_status=None))
    assert "Civil Status is required" in issues
    assert field_issues["civil_status"] == "Civil Status is required"


def test_sex_and_modality_no_longer_default_silently():
    _, issues, field_issues, _ = _check_import_row(_row(sex="", modality=""))
    assert "Sex is required" in issues
    assert "Learning Modality is required" in issues
    assert field_issues["sex"] == "Sex is required"
    assert field_issues["modality"] == "Learning Modality is required"


def test_value_outside_the_dropdown_is_rejected_but_kept_for_display():
    clean, issues, field_issues, _ = _check_import_row(_row(civil_status="singel", employment_status="Working"))
    assert any(i.startswith("Civil Status must be one of") for i in issues)
    assert clean["civil_status"] == "singel"
    assert field_issues["civil_status"].startswith("Civil Status must be one of")


def test_number_and_contact_format_checks():
    _, issues, field_issues, _ = _check_import_row(
        _row(contact_number="12345", distance_from_clc_km="far", monthly_income="-5")
    )
    assert "Contact Number must be 11 digits starting with 09" in issues
    assert "Distance from CLC must be a number" in issues
    assert "Monthly Income cannot be negative" in issues
    assert field_issues["contact_number"] == "Contact Number must be 11 digits starting with 09"
    assert field_issues["distance_from_clc_km"] == "Distance from CLC must be a number"
    assert field_issues["monthly_income"] == "Monthly Income cannot be negative"


def test_future_birthdate_is_rejected():
    _, issues, field_issues, _ = _check_import_row(_row(birthdate="2999-01-01"))
    assert "Date of Birth cannot be in the future" in issues
    assert field_issues["birthdate"] == "Date of Birth cannot be in the future"


def test_not_employed_is_an_error_not_a_guess():
    _, issues, field_issues, field_notes = _check_import_row(_row(employment_status="Not Employed"))
    assert "Employment Status must be Employed or Unemployed (you entered 'Not Employed')." in issues
    assert field_issues["employment_status"] == (
        "Employment Status must be Employed or Unemployed (you entered 'Not Employed')."
    )
    assert "employment_status" not in field_notes


def test_self_employed_spellings_are_accepted_as_employed_with_a_note():
    for spelling in ("Self-employed", "Self employed", "Selfemployed", "Self-Employed / Business Owner"):
        clean, issues, field_issues, field_notes = _check_import_row(_row(employment_status=spelling))
        assert issues == [], f"{spelling!r} should not be an error"
        assert clean["employment_status"] == "Employed"
        assert field_notes["employment_status"] == f"Changed from '{spelling}'"
        assert "employment_status" not in field_issues


def test_notepad_modality_is_an_error_not_a_guess():
    _, issues, field_issues, _ = _check_import_row(_row(modality="Notepad"))
    assert "Learning Modality must be Face-to-Face, Modular or Blended (you entered 'Notepad')." in issues
    assert field_issues["modality"] == (
        "Learning Modality must be Face-to-Face, Modular or Blended (you entered 'Notepad')."
    )


def test_maybe_re_enrollee_is_an_error_not_a_guess():
    _, issues, field_issues, _ = _check_import_row(_row(re_enrollee="Maybe"))
    assert "Re-enrollee must be Yes or No (you entered 'Maybe')." in issues
    assert field_issues["re_enrollee"] == "Re-enrollee must be Yes or No (you entered 'Maybe')."


def test_blank_re_enrollee_is_not_an_issue():
    _, issues, field_issues, _ = _check_import_row(_row(re_enrollee=""))
    assert issues == []
    assert "re_enrollee" not in field_issues


def test_duplicate_lrn_with_invalid_modality_is_an_error_not_a_duplicate(monkeypatch):
    monkeypatch.setattr(learner_routes, "fetch_all", lambda *a, **k: [{"lrn": "123456789012"}])
    preview = _preview_rows([_row(modality="Notepad")])
    assert len(preview) == 1
    row = preview[0]
    assert row["status"] == "error"
    assert "This LRN is already registered" in row["issue"]
    assert "Notepad" in row["issue"]
    assert row["field_issues"]["lrn"] == "This LRN is already registered"
    assert "modality" in row["field_issues"]


def test_duplicate_lrn_with_no_other_issues_stays_a_duplicate(monkeypatch):
    monkeypatch.setattr(learner_routes, "fetch_all", lambda *a, **k: [{"lrn": "123456789012"}])
    preview = _preview_rows([_row()])
    assert preview[0]["status"] == "duplicate"


def test_reimporting_an_exported_csv_value_strips_the_excel_text_wrapper():
    # Our own CSV export (Utils.csvRow, core/utils.js) writes text columns
    # as ="123456789012" so Excel/Sheets don't show scientific notation --
    # re-uploading that same file must read back the plain digits.
    assert _normalise_import_value('="123456789012"') == "123456789012"
    assert _normalise_import_value('="09171234567"') == "09171234567"
    # The other common Excel "force text" convention: a leading apostrophe.
    assert _normalise_import_value("'123456789012") == "123456789012"
    # Untouched when there's no wrapper.
    assert _normalise_import_value("123456789012") == "123456789012"
    assert _normalise_import_value(None) is None


def test_strict_helpers_never_guess():
    assert strict_modality("Notepad") is None
    assert strict_modality("") is None
    assert strict_modality(None) is None
    assert strict_modality("Face-to-Face") == "FACE_TO_FACE"
    assert strict_modality("modular") == "MODULAR"
    assert strict_modality("f2f") == "FACE_TO_FACE"

    assert strict_yes_no("Maybe") is None
    assert strict_yes_no("") is None
    assert strict_yes_no(None) is None
    assert strict_yes_no("Yes") is True
    assert strict_yes_no("y") is True
    assert strict_yes_no("No") is False
    assert strict_yes_no("0") is False


def test_template_marks_required_columns_and_has_dropdowns():
    wb = load_workbook(BytesIO(build_import_template().read()))
    assert wb.sheetnames[0] == "Instructions"
    ws = wb["Learners"]
    headers = [c.value for c in ws[1]]
    assert "Civil Status *" in headers
    assert "Middle Name" in headers
    assert len(headers) == len(IMPORT_COLUMNS)

    civil_col = headers.index("Civil Status *") + 1
    civil_letter = ws.cell(row=1, column=civil_col).column_letter
    list_validations = [
        dv for dv in ws.data_validations.dataValidation
        if dv.type == "list" and f"{civil_letter}2" in str(dv.sqref)
    ]
    assert list_validations, "Civil Status column should be a dropdown"
    assert wb["Lists"].sheet_state == "hidden"


def test_filled_template_is_read_from_the_learners_sheet():
    # The template opens with an Instructions sheet; the importer must read
    # the Learners sheet and ignore the pre-formatted blank rows.
    from app.routes.learner_routes import _canonical_rows, _read_upload

    wb = load_workbook(BytesIO(build_import_template().read()))
    ws = wb["Learners"]
    values = ["123456789012", "Dela Cruz", "Juan", None, "Male", "2008-05-14",
              "Face-to-Face", "Single"]
    for col, value in enumerate(values, start=1):
        ws.cell(row=2, column=col, value=value)
    ws.cell(row=2, column=15, value="Formal Employment")  # Socio-economic Status
    out = BytesIO()
    wb.save(out)

    class Upload:
        filename = "learners.xlsx"

        def read(self):
            return out.getvalue()

    rows = _canonical_rows(_read_upload(Upload()))
    assert len(rows) == 1
    assert rows[0]["civil_status"] == "Single"
    assert _check_import_row(rows[0])[1] == []


def test_socio_economic_status_is_mandatory():
    _, issues, _, _ = _check_import_row(_row(occupation=None))
    assert "Socio-economic Status is required" in issues
