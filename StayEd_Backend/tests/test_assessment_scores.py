from app.routes.learner_routes import (
    ASSESSMENT_FLT_ROW_IDS,
    ASSESSMENT_FLT_TOTAL_MAX_SCORE,
    ASSESSMENT_PASSING_LIKELIHOOD_THRESHOLD,
    _assessment_likelihood_from_percentage,
    _assessment_overall_percentage,
    _coerce_number,
)


def _scores_summing_to(total):
    """One row carries the whole total; the rest are left unset."""
    scores = {row_id: {} for row_id in ASSESSMENT_FLT_ROW_IDS}
    scores[ASSESSMENT_FLT_ROW_IDS[0]] = {"post": total}
    return scores


def test_coerce_number_treats_missing_and_blank_as_none():
    assert _coerce_number(None) is None
    assert _coerce_number("") is None
    assert _coerce_number("not a number") is None
    assert _coerce_number("12.5") == 12.5
    assert _coerce_number(12) == 12.0


def test_overall_percentage_is_none_when_nothing_recorded():
    scores = {row_id: {} for row_id in ASSESSMENT_FLT_ROW_IDS}
    assert _assessment_overall_percentage(scores) is None


def test_overall_percentage_matches_the_documented_denominator():
    scores = _scores_summing_to(ASSESSMENT_FLT_TOTAL_MAX_SCORE)
    assert _assessment_overall_percentage(scores) == 100.0


def test_overall_percentage_is_clamped_to_100():
    # A row entered above its own max (teacher typo, no client-side guard
    # against the full-row sum) must never produce an impossible percentage
    # like 133% -- the frontend already clamps its equivalent calculation,
    # so the API has to agree with it.
    scores = _scores_summing_to(ASSESSMENT_FLT_TOTAL_MAX_SCORE * 2)
    assert _assessment_overall_percentage(scores) == 100.0


def test_likelihood_label_follows_the_passing_threshold():
    assert _assessment_likelihood_from_percentage(ASSESSMENT_PASSING_LIKELIHOOD_THRESHOLD) == "HIGH LIKELIHOOD"
    assert _assessment_likelihood_from_percentage(ASSESSMENT_PASSING_LIKELIHOOD_THRESHOLD - 0.1) == "LOW LIKELIHOOD"
    assert _assessment_likelihood_from_percentage(None) is None
