from app.services.learner_service import _monitoring_engaged_sql, _shape_learner


def _base_row(**overrides):
    """Minimal row dict _shape_learner needs, with every risk/engagement
    input defaulted so each test only has to override what it's checking."""
    row = {
        "learner_id": 1,
        "lrn": "123456789012",
        "first_name": "Juan",
        "last_name": "Santos",
        "sex": "MALE",
        "age": 20,
        "date_of_birth": None,
        "risk_level": None,
        "risk_probability": None,
        "batch_count": 0,
        "has_engagement": False,
        "learning_modality": "MODULAR",
        "event_label": None,
        "event_date": None,
        "enrollment_date": None,
    }
    row.update(overrides)
    return row


def test_risk_shown_once_monitoring_and_engagement_are_both_real():
    row = _base_row(
        risk_level="HIGH", risk_probability=0.82, batch_count=1, has_engagement=True,
    )
    shaped = _shape_learner(row)
    assert shaped["risk"] == "High"
    assert shaped["risk_probability"] == 0.82


def test_risk_hidden_without_a_released_module_batch():
    # This is exactly the bug scenario: a risk_assessment row exists (e.g.
    # seeded ahead of real activity) but no module has ever been released,
    # so it must not be shown as an earned verdict.
    row = _base_row(
        risk_level="HIGH", risk_probability=0.82, batch_count=0, has_engagement=True,
    )
    shaped = _shape_learner(row)
    assert shaped["risk"] == "Not Yet Assessed"
    assert shaped["risk_probability"] == 0.0


def test_risk_hidden_without_real_engagement():
    row = _base_row(
        risk_level="MODERATE", risk_probability=0.5, batch_count=1, has_engagement=False,
    )
    shaped = _shape_learner(row)
    assert shaped["risk"] == "Not Yet Assessed"


def test_risk_hidden_when_no_prediction_exists_yet():
    row = _base_row(risk_level=None, batch_count=1, has_engagement=True)
    shaped = _shape_learner(row)
    assert shaped["risk"] == "Not Yet Assessed"


def test_monitoring_engaged_sql_uses_the_given_enrollment_reference():
    default_sql = _monitoring_engaged_sql()
    assert "ce.enrollment_id" in default_sql

    custom_sql = _monitoring_engaged_sql("ra.enrollment_id")
    assert "ra.enrollment_id" in custom_sql
    assert "ce.enrollment_id" not in custom_sql

    # The gate requires a released batch AND (a returned module OR a
    # present attendance record) -- losing either half of this silently
    # reopens the admin-dashboard bug.
    assert "module_release_batch" in custom_sql
    assert "date_returned IS NOT NULL" in custom_sql
    assert "attendance_status = 'PRESENT'" in custom_sql
