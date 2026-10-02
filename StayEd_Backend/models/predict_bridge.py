"""Model bridge invoked by prediction_service.run_external_model via
MODEL_COMMAND. Matches the contract it already expects:

    stdin:  one JSON object with the feature values (see features.py)
    stdout: one JSON object with at least "risk_probability" (0-1),
            here representing P(NotCompleted), i.e. dropout risk.

Loads the joblib pipeline trained by train_model.py, so retraining never
requires touching this file or the Flask app.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import joblib
import pandas as pd
import xgboost as xgb

from features import FEATURE_COLUMNS, NUMERIC_FEATURES

ARTIFACT_PATH = Path(__file__).resolve().parent / "stayed_xgb_v2.joblib"


def _top_factors(pipeline, row: pd.DataFrame, limit: int = 3) -> list[dict]:
    """Top factors behind THIS specific prediction.

    Previously this ranked by classifier.feature_importances_, which is a
    single global ranking baked into the trained model -- identical for
    every learner regardless of their actual data. It surfaced distance_km
    and occupation as the "top factors" for every high-risk learner even
    when both were completely unrecorded (None) for that learner, which
    reads as the model reasoning about data it doesn't have.

    This uses the booster's native per-instance contributions instead (the
    same SHAP-value computation XGBoost ships built in, via
    pred_contribs=True) -- how much each feature actually pushed THIS row's
    prediction up or down from the model's baseline. Two learners with
    different data now get different top factors, as they should.

    A one-hot-encoded categorical feature (sex, learning_level, modality,
    occupation) spans several encoder columns; only one is "hot" per row,
    so contributions are summed back to the base feature instead of ranking
    raw encoder columns -- otherwise two columns of the same feature (e.g.
    two occupation categories) can both land in the top N and get treated
    as separate factors.
    """
    preprocess = pipeline.named_steps["preprocess"]
    classifier = pipeline.named_steps["classify"]
    encoder_names = preprocess.get_feature_names_out()

    transformed = preprocess.transform(row)
    if hasattr(transformed, "toarray"):
        transformed = transformed.toarray()
    dmatrix = xgb.DMatrix(transformed, feature_names=list(encoder_names))
    # pred_contribs appends a final bias/base-value column -- drop it, it's
    # not any one feature's contribution.
    contributions = classifier.get_booster().predict(dmatrix, pred_contribs=True)[0][:-1]

    grouped: dict[str, float] = {}
    for encoded_name, contribution in zip(encoder_names, contributions):
        # encoded_name looks like "categorical__sex_MALE" or "numeric__age"
        raw_name = encoded_name.split("__", 1)[-1]
        base_feature = next((f for f in FEATURE_COLUMNS if raw_name == f or raw_name.startswith(f + "_")), raw_name)
        grouped[base_feature] = grouped.get(base_feature, 0.0) + float(contribution)

    ranked = sorted(grouped.items(), key=lambda pair: abs(pair[1]), reverse=True)

    factors = []
    for base_feature, contribution in ranked[:limit]:
        # Numeric features (age, distance_km) populate factor_value.
        # Categorical/boolean features (sex, modality, is_re_enrollee, etc.)
        # populate factor_value_text instead, so they're never displayed
        # as "n/a" even though they're counted toward the risk score.
        raw_value = row.iloc[0].get(base_feature)
        is_numeric = base_feature in NUMERIC_FEATURES
        value = float(raw_value) if is_numeric and raw_value is not None and pd.notna(raw_value) else None
        value_text = None
        if not is_numeric and raw_value is not None and pd.notna(raw_value):
            value_text = str(raw_value)
        factors.append(
            {
                "name": base_feature,
                "value": value,
                "value_text": value_text,
                "importance": round(abs(contribution), 6),
            }
        )
    return factors


def main() -> None:
    payload = json.loads(sys.stdin.read())
    row = pd.DataFrame([{col: payload.get(col) for col in FEATURE_COLUMNS}])

    pipeline = joblib.load(ARTIFACT_PATH)
    probability = float(pipeline.predict_proba(row)[0, 1])

    result = {
        "risk_probability": round(probability, 5),
        "factors": _top_factors(pipeline, row),
    }
    print(json.dumps(result))


if __name__ == "__main__":
    main()