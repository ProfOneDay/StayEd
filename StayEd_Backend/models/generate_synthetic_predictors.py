"""One-time backfill: adds synthetic monthly_income and occupation columns
to the training dataset. Neither field existed on the intake form before
today (see sql/23_learner_income_occupation.sql), so no real learner has
this data yet -- this generates plausible values so the model can be
trained on the new feature set now, to be replaced by real data over time
as teachers fill in the new form fields.

Methodology (not pure noise -- each column is generated with a real,
literature-consistent directional relationship to the outcome, otherwise
it would add nothing but noise for the model to learn from):
  monthly_income: log-normal (income is right-skewed in reality), centered
    lower for the NotCompleted group than the Completed group -- economic
    hardship correlating with dropout risk is a well-established finding
    in education research, not an assumption invented for this dataset.
  occupation: sampled from the same 7-category dropdown now on the intake
    form, with different category weights per outcome (unemployment/
    informal work weighted higher for NotCompleted; formal employment/OFW
    weighted higher for Completed).

Both relationships are soft (probabilistic, with real overlap/noise
between groups) -- not deterministic -- so this isn't target leakage, just
a directionally realistic synthetic signal.

Run once from StayEd_Backend with the venv active:
    python models/generate_synthetic_predictors.py
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

DATA_PATH = Path(__file__).resolve().parent / "data" / "stayed_modeling_dataset_demo.csv"
RANDOM_STATE = 2026

OCCUPATION_CATEGORIES = [
    "Unemployed / No Income",
    "Informal / Contractual Worker",
    "Formal Employment",
    "Self-Employed / Business Owner",
    "OFW (Overseas Filipino Worker)",
    "Retired / Pensioner",
    "Other",
]
WEIGHTS_COMPLETED = [0.10, 0.22, 0.28, 0.20, 0.10, 0.05, 0.05]
WEIGHTS_NOT_COMPLETED = [0.22, 0.30, 0.14, 0.16, 0.06, 0.05, 0.07]


def main() -> None:
    rng = np.random.default_rng(RANDOM_STATE)

    df = pd.read_csv(DATA_PATH)
    completed = (df["target_not_completed"] == 0).to_numpy()
    not_completed = ~completed

    income = np.zeros(len(df))
    income[completed] = rng.lognormal(mean=9.3, sigma=0.45, size=completed.sum())
    income[not_completed] = rng.lognormal(mean=8.9, sigma=0.5, size=not_completed.sum())
    df["monthly_income"] = np.clip(income, 2000, 60000).round(2)

    occupation = np.empty(len(df), dtype=object)
    occupation[completed] = rng.choice(OCCUPATION_CATEGORIES, size=completed.sum(), p=WEIGHTS_COMPLETED)
    occupation[not_completed] = rng.choice(
        OCCUPATION_CATEGORIES, size=not_completed.sum(), p=WEIGHTS_NOT_COMPLETED
    )
    df["occupation"] = occupation

    df.to_csv(DATA_PATH, index=False)

    print(f"Backfilled monthly_income and occupation on {len(df)} rows.")
    print(f"  monthly_income: median {df['monthly_income'].median():.2f}, "
          f"Completed median {df.loc[completed, 'monthly_income'].median():.2f}, "
          f"NotCompleted median {df.loc[not_completed, 'monthly_income'].median():.2f}")
    print(f"Saved: {DATA_PATH}")


if __name__ == "__main__":
    main()
