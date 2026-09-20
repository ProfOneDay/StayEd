"""
StayEd AI Intervention Service

Generates intervention recommendations using OpenAI, based on the
learner's Random Forest risk prediction and the factors returned
by the model.

This service does NOT perform the prediction itself.
The Random Forest remains responsible for risk prediction.
"""

import json
import os
from typing import Any

from openai import OpenAI

# --------------------------------------------------------------------
# Configuration
# --------------------------------------------------------------------

_api_key = os.getenv("OPENAI_API_KEY", "").strip()
_client = OpenAI(api_key=_api_key) if _api_key else None

_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")


# --------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------

def _build_prompt(
    risk_level: str,
    risk_probability: float,
    factors: list[dict[str, Any]],
    intervention: dict[str, Any] | None,
) -> str:
    """Build the prompt sent to OpenAI for the intervention recommendation."""
    factors_text = "\n".join(
        f"- {f.get('name')}: {f.get('value')}" for f in factors
    ) or "- No additional factors provided"

    intervention_text = "None specified"
    if intervention:
        intervention_text = "\n".join(
            f"- {key}: {value}" for key, value in intervention.items()
        )

    return f"""You are an academic support advisor for an Alternative Learning
System (ALS) program. A teacher has just assigned the intervention
described below to a learner. Based on the learner's dropout risk
assessment and the intervention already assigned, provide a refined
AI recommendation: confirm or adjust the priority/category, and give
a clear reason and concrete next action tailored to this learner.

Risk level: {risk_level}
Dropout risk probability: {risk_probability:.2f}

Risk factors identified by the model:
{factors_text}

Intervention already assigned by the teacher:
{intervention_text}

Respond ONLY with a JSON object (no markdown, no preamble) in this
exact shape:
{{
  "title": "short intervention title",
  "priority": "HIGH" | "MEDIUM" | "LOW",
  "category": "LEARNER_SUPPORT" | "LEARNING_SUPPORT" | "ACCESSIBILITY_SUPPORT" | "MONITORING",
  "description": "1-2 sentence description of the intervention",
  "reason": "why this intervention fits this learner's risk profile",
  "recommended_action": "concrete next step for the advisor to take"
}}"""


# --------------------------------------------------------------------
# Public entrypoint
# --------------------------------------------------------------------

def generate_ai_recommendation(
    risk_level: str,
    risk_probability: float,
    factors: list[dict[str, Any]] | None = None,
    intervention: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Generate an intervention recommendation using OpenAI, based on the
    Random Forest result and (optionally) an intervention already
    assigned by the teacher.

    Parameters:
        risk_level:
            LOW, MODERATE, or HIGH

        risk_probability:
            Random Forest P(NotCompleted), from 0 to 1

        factors:
            Risk factors returned by predict_bridge.py

        intervention:
            The intervention already assigned by the teacher, if any
            (title, priority, category, description, reason,
            recommended_action).

    Returns:
        Dictionary containing the recommended intervention.
    """
    factors = factors or []

    if _client is None:
        return {
            "title": "Teacher Review Recommended",
            "priority": "MEDIUM",
            "category": "MONITORING",
            "description": "Review the learner's risk profile and assigned support needs.",
            "reason": "AI recommendations are unavailable because no OpenAI API key is configured.",
            "recommended_action": "Review the learner details and follow up with the learner.",
        }

    prompt = _build_prompt(risk_level, risk_probability, factors, intervention)

    response = _client.chat.completions.create(
        model=_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.4,
    )

    raw_content = response.choices[0].message.content

    print("=== RAW AI RESPONSE ===")
    print(raw_content)
    print("========================")

    cleaned = raw_content.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
        cleaned = cleaned.strip()

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        parsed = {
            "title": "AI Recommendation (unparsed)",
            "priority": "MEDIUM",
            "category": "LEARNER_SUPPORT",
            "description": raw_content,
            "reason": "The AI response could not be parsed as JSON.",
            "recommended_action": "Review the raw AI response in the backend logs.",
        }

    return parsed

    

def generate_next_step(intervention: dict[str, Any], outcome: str, notes: str) -> str:
    """Generate a next step from the outcome the teacher recorded."""
    prompt = f"""You are an academic support advisor for an Alternative Learning
System (ALS) program. A teacher recorded a follow-up on an intervention.
Suggest the next step. Stay within the same intervention type; do not
invent a different intervention.

Intervention type: {intervention.get('intervention_type')}
Intervention description: {intervention.get('description')}
Outcome: {outcome}
Teacher notes: {notes}

Reply in 2-3 plain sentences (no markdown, no JSON): what the teacher
should do next and when to follow up."""

    response = _client.chat.completions.create(
        model=_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.4,
    )
    return response.choices[0].message.content.strip()