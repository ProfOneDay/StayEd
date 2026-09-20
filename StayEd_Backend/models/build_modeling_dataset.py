"""Rebuilds stayed_modeling_dataset_demo.csv's real-data columns from the
Dataset/ source files at the repo root, so the training set can be
refreshed whenever Dataset/ changes instead of being a one-off hand export.

Source of truth is Dataset/StayEd_Modeling_Dataset.csv (already
feature-engineered, row-aligned with Dataset/Master_Merged_Final_Updated_7.csv).
Master isn't otherwise used as a feature source -- none of its extra columns
(name, LRN, assessment scores, etc.) are part of the model's feature
contract in features.py, which mirrors exactly what the live DB captures via
learner/learning_class/class_enrollment. It's only used here to sanity-check
the completion label.

The row filter and value mappings below were reverse-engineered from the
demo dataset already committed in this repo -- applying them to the current
Dataset/ files reproduced that file's 6,016 rows exactly (same rows, same
values), which is what justified each rule:
  - age: keep 10-100. The raw Age column has values like 0, 1, 1823 and
    2016 -- birth years/IDs leaking into the field, not real ages -- and
    nothing falls between 81 and 1029, so this range cleanly separates
    real ages from corrupted ones without being a tight, brittle cutoff.
  - modality: only the 5 single-modality spellings that map cleanly to
    FACE_TO_FACE/MODULAR/BLENDED are kept. Combo values ("Modular (Print)
    + Face to Face") and delivery types the DB schema doesn't support
    (Online, Homeschooling, Educational Television, Independent Learning,
    Radio-based -- see ck_class_enrollment_modality in 00_core_schema.sql)
    are dropped rather than force-mapped to the nearest enum.
  - learning_level: "A&E Secondary" (+ "with EST") -> JUNIOR_HIGH_SCHOOL,
    "A&E Elementary" -> ELEMENTARY, "BLP" -> BLP. This source never
    distinguishes Junior/Senior High, so SENIOR_HIGH_SCHOOL never comes out
    of this mapping.
  - distance_km: est_distance(km) copied as-is, but null above 100km --
    the column has a hard gap between 50.5 and 164 km, so everything past
    it (up to 16,267km) is a units/geocoding error, not real distance to a
    community learning center.
  - sex: case-insensitive M*/F* match (covers "M", "m", "Male", "male",
    ...); the one "male/female" row is unrecognized and dropped like any
    other missing value.

Neither monthly_income nor occupation exist in Dataset/ (see
generate_synthetic_predictors.py's docstring for why), so this script only
writes the columns that DO have a real source. Run generate_synthetic_
predictors.py right after to backfill those two.

The exported CSV is also balanced 50/50 on target_not_completed, via
SMOTENC-generated synthetic rows for the minority class rather than
dropping real majority-class rows (see _balance()'s docstring). Synthetic
rows are tagged is_synthetic=True / source_learner_id "SYNTH_00001" etc.,
so train_model.py can keep them out of its evaluation split -- reported
metrics should only ever reflect real, unbalanced production-like data.

Run from StayEd_Backend with the venv active:
    python models/build_modeling_dataset.py
    python models/generate_synthetic_predictors.py
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd
from imblearn.over_sampling import SMOTENC

MODEL_DIR = Path(__file__).resolve().parent
DATASET_DIR = MODEL_DIR.parent.parent / "Dataset"
MASTER_PATH = DATASET_DIR / "Master_Merged_Final_Updated_7.csv"
MODELING_PATH = DATASET_DIR / "StayEd_Modeling_Dataset.csv"
OUT_PATH = MODEL_DIR / "data" / "stayed_modeling_dataset_demo.csv"

AGE_MIN, AGE_MAX = 10, 100
DISTANCE_MAX_KM = 100
RANDOM_STATE = 2026

_MODALITY_MAP = {
    "face to face": "FACE_TO_FACE",
    "blended": "BLENDED",
    "modular (print)": "MODULAR",
    "modular (digital)": "MODULAR",
    "modular": "MODULAR",
}

_LEARNING_LEVEL_MAP = {
    "a&e secondary": "JUNIOR_HIGH_SCHOOL",
    "a&e secondary with est": "JUNIOR_HIGH_SCHOOL",
    "a&e elementary": "ELEMENTARY",
    "blp": "BLP",
}

# Columns SMOTENC balances on -- same subset of FEATURE_COLUMNS available at
# this stage (monthly_income/occupation don't exist yet). age/distance_km
# are numeric; the rest are indices into categorical_features below, matching
# how train_model.py's own SMOTENC step treats CATEGORICAL_FEATURES +
# BOOLEAN_FEATURES as categorical (mode-of-neighbors, not interpolated).
_SMOTE_FEATURES = ["age", "distance_km", "sex", "learning_level", "modality", "is_re_enrollee"]
_SMOTE_CATEGORICAL_IDX = [2, 3, 4, 5]


def _map_sex(raw: object) -> str | None:
    v = str(raw or "").strip().lower()
    if v == "m" or v == "male":
        return "MALE"
    if v == "f" or v == "female":
        return "FEMALE"
    return None


def build() -> pd.DataFrame:
    master = pd.read_csv(MASTER_PATH, low_memory=False)
    model = pd.read_csv(MODELING_PATH, low_memory=False)
    if len(master) != len(model):
        raise ValueError(
            f"Master ({len(master)} rows) and modeling ({len(model)} rows) "
            "datasets are no longer row-aligned -- mappings below assume "
            "row i in one is the same learner as row i in the other."
        )

    distance = model["est_distance(km)"]
    df = pd.DataFrame(
        {
            "source_learner_id": model["Learner_ID"],
            "age": model["Age"],
            "sex": model["Sex"].map(_map_sex),
            "learning_level": model["learning_level_af3"]
            .astype(str).str.strip().str.lower().map(_LEARNING_LEVEL_MAP),
            "modality": model["Modality"]
            .astype(str).str.strip().str.lower().map(_MODALITY_MAP),
            "is_re_enrollee": model["is_re_enrollee"],
            "distance_km": distance.where(distance <= DISTANCE_MAX_KM),
            "target_not_completed": 1 - model["completion_binary"],
        }
    )

    keep = (
        df["age"].between(AGE_MIN, AGE_MAX)
        & df["sex"].notna()
        & df["learning_level"].notna()
        & df["modality"].notna()
    )
    df = df.loc[keep].reset_index(drop=True)
    df["age"] = df["age"].astype("int64")
    df["target_not_completed"] = df["target_not_completed"].astype("int64")

    _audit_label_against_master(master.loc[keep].reset_index(drop=True), df)
    return _balance(df)


def _balance(df: pd.DataFrame) -> pd.DataFrame:
    """Tops up the minority class (Completed) with SMOTENC-generated
    synthetic rows until target_not_completed is 50/50, instead of
    undersampling the majority class -- every real row is kept.

    SMOTENC needs fully-imputed input to compute nearest-neighbor
    distances (NaN breaks it), so distance_km/is_re_enrollee are
    median/mode-filled on a COPY used only for fitting -- the real rows
    returned below keep their true, possibly-missing values untouched.
    Only the newly generated synthetic rows carry imputed-and-interpolated
    values, same tradeoff train_model.py's own SMOTENC step already makes
    (see _balance_training_split there).

    imblearn returns the original samples first, unchanged, then appends
    the synthetic ones -- verified empirically, since silently mislabeling
    real vs. synthetic here would defeat the point of tagging them.
    """
    real = df.sort_values("source_learner_id").reset_index(drop=True).copy()
    real["is_synthetic"] = False

    X = real[_SMOTE_FEATURES].copy()
    X["distance_km"] = X["distance_km"].fillna(X["distance_km"].median())
    X["is_re_enrollee"] = X["is_re_enrollee"].fillna(X["is_re_enrollee"].mode().iloc[0])
    y = real["target_not_completed"]

    smote = SMOTENC(categorical_features=_SMOTE_CATEGORICAL_IDX, random_state=RANDOM_STATE)
    X_res, y_res = smote.fit_resample(X, y)

    synth = X_res.iloc[len(real):].reset_index(drop=True)
    synth["age"] = synth["age"].round().astype("int64")
    synth["target_not_completed"] = y_res.iloc[len(real):].reset_index(drop=True).astype("int64")
    synth["source_learner_id"] = [f"SYNTH_{i:05d}" for i in range(1, len(synth) + 1)]
    synth["is_synthetic"] = True

    return pd.concat([real, synth[real.columns]], ignore_index=True)


def _audit_label_against_master(master_kept: pd.DataFrame, df: pd.DataFrame) -> None:
    """Cross-checks target_not_completed against Master's own status
    columns, purely as a sanity print -- doesn't affect the output."""
    status = master_kept["completion_status_af3"].astype(str).str.upper()
    known = status.isin(["COMPLETED", "NOT COMPLETED"])
    if not known.any():
        return
    agree = (
        (status[known] == "NOT COMPLETED") == (df.loc[known, "target_not_completed"] == 1)
    ).mean()
    print(f"Label sanity check vs Master completion_status_af3: {agree:.1%} agreement on {known.sum()} labeled rows")


def main() -> None:
    df = build()
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = OUT_PATH.with_suffix(".tmp.csv")
    df.to_csv(tmp_path, index=False)
    tmp_path.replace(OUT_PATH)
    print(f"Wrote {len(df)} rows to {OUT_PATH} "
          f"({(~df['is_synthetic']).sum()} real, {df['is_synthetic'].sum()} synthetic)")
    print(f"target_not_completed balance: {df['target_not_completed'].value_counts().to_dict()}")


if __name__ == "__main__":
    main()
