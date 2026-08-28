from __future__ import annotations

import json
import shlex
import subprocess
from datetime import date, timedelta

from flask import current_app

from ..db import fetch_one, get_db


class InsufficientDataError(Exception):
    """Raised when an enrollment has no released module batches yet.

    Monitoring -- and therefore risk prediction -- only begins once a learner
    has been assigned their first module batch, per the risk gate requirement.
    """


def _compute_features(enrollment_id: int) -> dict:
    """Build the model's feature payload from real StayEd data -- no values
    are ever trusted from the caller. Every field here has a direct source:
    age/sex from learner, learning_level from learning_class, modality/
    is_re_enrollee/distance_km from class_enrollment.
    """
    row = fetch_one(
        """
        SELECT
            EXTRACT(YEAR FROM AGE(CURRENT_DATE, l.date_of_birth))::int AS age,
            l.sex,
            lc.learning_level,
            ce.learning_modality AS modality,
            ce.is_re_enrollee,
            ce.distance_from_clc_km AS distance_km
        FROM class_enrollment ce
        JOIN learner l ON l.learner_id = ce.learner_id
        JOIN learning_class lc ON lc.class_id = ce.class_id
        WHERE ce.enrollment_id = %s
        """,
        (enrollment_id,),
    )
    return {
        "age": row["age"],
        "sex": row["sex"],
        "learning_level": row["learning_level"],
        "modality": row["modality"],
        "is_re_enrollee": int(row["is_re_enrollee"]) if row["is_re_enrollee"] is not None else None,
        "distance_km": float(row["distance_km"]) if row["distance_km"] is not None else None,
    }


def run_external_model(command: str, payload: dict) -> dict:
    """Run a configured model bridge (for example Rscript) over JSON stdin.

    Contract:
      stdin:  one JSON object
      stdout: one JSON object containing at least risk_probability

    This keeps the Flask API independent from whether the trained StayEd Random
    Forest remains in R or is later exported to a Python-compatible artifact.
    """
    proc = subprocess.run(
        shlex.split(command),
        input=json.dumps(payload),
        text=True,
        capture_output=True,
        timeout=60,
        check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or "Prediction command failed.")
    result = json.loads(proc.stdout)
    probability = float(result["risk_probability"])
    if not 0 <= probability <= 1:
        raise ValueError("Model returned an invalid risk_probability.")
    result["risk_level"] = "LOW" if probability < 0.40 else "MODERATE" if probability < 0.70 else "HIGH"
    return result


def trigger_prediction(
    enrollment_id: int,
    user_id: int,
    *,
    monitoring_start: date | None = None,
    monitoring_end: date | None = None,
) -> dict:
    """Compute and persist a fresh risk assessment for one enrollment.

    Shared by the `/predictions/run` endpoint and best-effort background
    callers (e.g. after a module return or intervention change). Features are
    always computed server-side from real StayEd data via `_compute_features`
    -- never accepted from the caller, so nothing here can be used to
    fabricate a risk score. Raises on any failure -- background callers
    should catch and ignore, since MODEL_COMMAND may not be configured in
    every environment.
    """
    batch_count = fetch_one(
        "SELECT COUNT(*) AS n FROM module_release_batch WHERE enrollment_id=%s",
        (enrollment_id,),
    )
    if not batch_count or not batch_count["n"]:
        raise InsufficientDataError(
            "This learner has no released modules yet -- prediction requires at least one module batch."
        )

    model = fetch_one(
        "SELECT model_id, model_version, algorithm FROM model_info WHERE model_status='ACTIVE' ORDER BY training_date DESC LIMIT 1"
    )
    if not model:
        raise RuntimeError("No ACTIVE model is registered in model_info.")

    command = current_app.config.get("MODEL_COMMAND")
    if not command:
        raise RuntimeError(
            "The prediction API is ready, but MODEL_COMMAND is not configured with the trained Random Forest bridge yet."
        )

    monitoring_end = monitoring_end or date.today()
    monitoring_start = monitoring_start or (monitoring_end - timedelta(days=30))

    features = _compute_features(enrollment_id)
    result = run_external_model(command, features)
    probability = float(result["risk_probability"])

    db = get_db()
    with db.cursor() as cur:
        cur.execute(
            """
            INSERT INTO risk_assessment (
                model_id, enrollment_id, monitoring_start_date, monitoring_end_date,
                data_sufficiency_status, risk_probability, generated_by_user_id
            ) VALUES (%s,%s,%s,%s,'PREDICTION_GENERATED',%s,%s)
            ON CONFLICT (model_id, enrollment_id, monitoring_start_date, monitoring_end_date)
            DO UPDATE SET data_sufficiency_status='PREDICTION_GENERATED',
                          risk_probability=EXCLUDED.risk_probability,
                          generated_by_user_id=EXCLUDED.generated_by_user_id,
                          assessment_date=CURRENT_TIMESTAMP
            RETURNING risk_assessment_id, risk_probability, risk_level, assessment_date
            """,
            (model["model_id"], enrollment_id, monitoring_start, monitoring_end, probability, user_id),
        )
        saved = cur.fetchone()

        for factor in result.get("factors", []) if isinstance(result.get("factors"), list) else []:
            name = str(factor.get("name") or factor.get("factor_name") or "").strip()
            if not name:
                continue
            cur.execute(
                """
                INSERT INTO risk_factors (risk_assessment_id, factor_name, factor_value, factor_value_text, importance_score)
                VALUES (%s,%s,%s,%s,%s)
                ON CONFLICT (risk_assessment_id, factor_name)
                DO UPDATE SET factor_value=EXCLUDED.factor_value, factor_value_text=EXCLUDED.factor_value_text, importance_score=EXCLUDED.importance_score
                """,
                (
                    saved["risk_assessment_id"], name,
                    factor.get("value") if factor.get("value") is not None else factor.get("factor_value"),
                    factor.get("value_text") if factor.get("value_text") is not None else factor.get("factor_value_text"),
                    factor.get("importance") if factor.get("importance") is not None else factor.get("importance_score"),
                ),
            )

    db.commit()

    return {"saved": saved, "model": model}
