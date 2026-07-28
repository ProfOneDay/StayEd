from __future__ import annotations

import json
import shlex
import subprocess


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
