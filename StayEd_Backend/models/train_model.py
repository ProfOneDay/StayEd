"""Train the StayEd dropout-risk XGBoost classifier on the demo dataset and
register it in the database (model_info / model_metrics), the same tables
the read-only dashboards already query.

XGBoost replaced the original Random Forest after the team's R model
comparison (model_eval_1_v2.r / model_eval_3.r) showed it winning on AUC
both overall and per-modality. Same feature set, same 70/30 split, same
Accuracy/Precision/Recall/F1/AUC evaluation -- only the classifier changed,
so predict_bridge.py needed no changes (it only ever calls the generic
pipeline.predict_proba() / classifier.feature_importances_).

Run it from StayEd_Backend with the venv active:
    python models/train_model.py
"""
from __future__ import annotations

import os
from datetime import date
from pathlib import Path

import joblib
import pandas as pd
import psycopg
from dotenv import load_dotenv
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from xgboost import XGBClassifier

from features import BOOLEAN_FEATURES, CATEGORICAL_FEATURES, FEATURE_COLUMNS, NUMERIC_FEATURES, TARGET_COLUMN

MODEL_DIR = Path(__file__).resolve().parent
DATA_PATH = MODEL_DIR / "data" / "stayed_modeling_dataset_demo.csv"
ARTIFACT_PATH = MODEL_DIR / "stayed_xgb_v1.joblib"

MODEL_VERSION = "stayed-xgb-v1"
RANDOM_STATE = 2026


def build_pipeline(scale_pos_weight: float = 1.0) -> Pipeline:
    preprocessor = ColumnTransformer(
        transformers=[
            ("numeric", SimpleImputer(strategy="median"), NUMERIC_FEATURES),
            (
                "categorical",
                Pipeline([
                    ("impute", SimpleImputer(strategy="most_frequent")),
                    ("encode", OneHotEncoder(handle_unknown="ignore")),
                ]),
                CATEGORICAL_FEATURES,
            ),
            ("boolean", SimpleImputer(strategy="most_frequent"), BOOLEAN_FEATURES),
        ]
    )
    # Params mirror the team's R evaluation (model_eval_1_v2.r / model_eval_3.r:
    # max_depth 6, eta/learning_rate 0.1, subsample/colsample_bytree 0.8,
    # 100 rounds) so this is the same model that was validated there.
    # scale_pos_weight substitutes for RandomForest's class_weight="balanced"
    # -- XGBoost has no direct equivalent, so it's computed from the training
    # split's class ratio and passed in explicitly (see train()).
    classifier = XGBClassifier(
        n_estimators=100,
        max_depth=6,
        learning_rate=0.1,
        subsample=0.8,
        colsample_bytree=0.8,
        objective="binary:logistic",
        eval_metric="logloss",
        scale_pos_weight=scale_pos_weight,
        random_state=RANDOM_STATE,
    )
    return Pipeline([("preprocess", preprocessor), ("classify", classifier)])


def train() -> dict:
    df = pd.read_csv(DATA_PATH)
    X = df[FEATURE_COLUMNS]
    y = df[TARGET_COLUMN]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.30, stratify=y, random_state=RANDOM_STATE
    )

    # Target is 1 = NotCompleted (at-risk) -- the minority-ish class here --
    # so weight it by the majority/minority ratio in the training split.
    class_counts = y_train.value_counts()
    scale_pos_weight = class_counts.get(0, 1) / max(class_counts.get(1, 1), 1)

    pipeline = build_pipeline(scale_pos_weight=scale_pos_weight)
    pipeline.fit(X_train, y_train)

    y_pred = pipeline.predict(X_test)
    y_prob = pipeline.predict_proba(X_test)[:, 1]

    metrics = {
        "ACCURACY": accuracy_score(y_test, y_pred),
        "PRECISION": precision_score(y_test, y_pred, zero_division=0),
        "RECALL": recall_score(y_test, y_pred, zero_division=0),
        "F1_SCORE": f1_score(y_test, y_pred, zero_division=0),
        "ROC_AUC": roc_auc_score(y_test, y_prob),
    }

    joblib.dump(pipeline, ARTIFACT_PATH)
    return metrics


def register_model(metrics: dict) -> None:
    load_dotenv(MODEL_DIR.parent / ".env")
    database_url = os.getenv("DATABASE_URL", "postgresql://postgres@127.0.0.1:5433/stayed_db")

    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO model_info (model_name, algorithm, model_version, training_date, model_status, description)
                VALUES (%s, %s, %s, %s, 'ACTIVE', %s)
                ON CONFLICT (model_version) DO UPDATE SET
                    training_date = EXCLUDED.training_date,
                    model_status = 'ACTIVE',
                    description = EXCLUDED.description
                RETURNING model_id
                """,
                (
                    "StayEd Dropout Risk Classifier",
                    "XGBoost (gradient boosting)",
                    MODEL_VERSION,
                    date.today(),
                    f"Trained on {DATA_PATH.name} ({len(pd.read_csv(DATA_PATH))} rows). "
                    "Predicts P(NotCompleted) from age, sex, learning_level, modality, "
                    "is_re_enrollee, distance_km.",
                ),
            )
            model_id = cur.fetchone()[0]

            # Only one model should be ACTIVE at a time so /predictions/run's
            # "latest ACTIVE model" lookup is unambiguous.
            cur.execute(
                "UPDATE model_info SET model_status='INACTIVE' WHERE model_id != %s AND model_status='ACTIVE'",
                (model_id,),
            )

            for metric_name, value in metrics.items():
                cur.execute(
                    """
                    INSERT INTO model_metrics (model_id, metric_name, metric_value)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (model_id, metric_name) DO UPDATE SET metric_value = EXCLUDED.metric_value
                    """,
                    (model_id, metric_name, round(float(value), 6)),
                )
        conn.commit()


if __name__ == "__main__":
    metrics = train()
    print("Evaluation metrics (30% holdout):")
    for name, value in metrics.items():
        print(f"  {name:10s} {value:.4f}")
    print(f"\nArtifact saved: {ARTIFACT_PATH}")

    register_model(metrics)
    print(f"Registered model_info row '{MODEL_VERSION}' as ACTIVE with metrics in model_metrics.")