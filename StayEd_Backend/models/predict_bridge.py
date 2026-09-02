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

from features import FEATURE_COLUMNS, NUMERIC_FEATURES

ARTIFACT_PATH = Path(__file__).resolve().parent / "stayed_xgb_v1.joblib"


def _top_factors(pipeline, row: pd.DataFrame, limit: int = 3) -> list[dict]:
    classifier = pipeline.named_steps["classify"]
    encoder_names = pipeline.named_steps["preprocess"].get_feature_names_out()
    importances = classifier.feature_importances_
    ranked = sorted(zip(encoder_names, importances), key=lambda pair: pair[1], reverse=True)

    factors = []
    for encoded_name, importance in ranked[:limit]:
        # encoded_name looks like "categorical__sex_MALE" or "numeric__age"
        raw_name = encoded_name.split("__", 1)[-1]
        base_feature = next((f for f in FEATURE_COLUMNS if raw_name == f or raw_name.startswith(f + "_")), raw_name)
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
                "importance": round(float(importance), 6),
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