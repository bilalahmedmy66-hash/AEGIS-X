import os
import json
import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional

from google import genai
from google.genai import types


BASE_DIR = Path(__file__).resolve().parents[1]
DB_PATH = BASE_DIR / "data" / "aegis.db"

MODEL = os.getenv("AEGIS_GEMINI_MODEL", "gemini-3.8-flash")

# Ordered for reliable academic/demo operation.
# gemini-3.5-flash has already been verified successfully
# with this AEGIS installation.
FALLBACK_MODELS = [
    "gemini-3.5-flash",
    "gemini-3.6-flash",
    "gemini-3.7-flash",
    "gemini-3.8-flash",
    "gemini-3.1-flash-lite",
]

# Remove duplicates while preserving order.
FALLBACK_MODELS = list(dict.fromkeys(FALLBACK_MODELS))


SYSTEM_INSTRUCTION = """
You are AEGIS AI, the security intelligence analyst inside AEGIS X.

Your job is to analyze security telemetry supplied by the AEGIS X platform.

You must:
- reason from the supplied evidence
- distinguish observed facts from interpretation
- never invent events, alerts, users, IPs, timestamps, or attack stages
- explain why a threat may be risky
- identify evidence supporting your assessment
- identify uncertainty when evidence is incomplete
- provide practical analyst investigation steps
- treat MITRE ATT&CK mappings as contextual unless the evidence supports them
- respect AEGIS SHIELD safety boundaries
- never claim that a simulated response was actually executed
- never recommend bypassing security controls
- never autonomously execute a destructive action

AEGIS X is an academic cybersecurity prototype.

Response actions are simulation-only.

Write like a professional SOC/security analyst:
concise, evidence-driven, technically precise, and easy for a human analyst to understand.
"""


def _db() -> sqlite3.Connection:
    connection = sqlite3.connect(str(DB_PATH))
    connection.row_factory = sqlite3.Row
    return connection


def _rows(connection: sqlite3.Connection, query: str, params: tuple = ()) -> List[Dict[str, Any]]:
    cursor = connection.execute(query, params)
    return [dict(row) for row in cursor.fetchall()]


def get_incident_context(incident_id: Optional[int] = None) -> Dict[str, Any]:
    connection = _db()

    try:
        incident = None
        events = []
        alerts = []
        responses = []

        if incident_id is not None:
            incident_rows = _rows(
                connection,
                "SELECT * FROM security_incidents WHERE id = ?",
                (int(incident_id),),
            )

            if incident_rows:
                incident = incident_rows[0]

                source_ip = incident.get("source_ip")
                incident_type = incident.get("incident_type")

                if source_ip:
                    events = _rows(
                        connection,
                        """
                        SELECT *
                        FROM security_events
                        WHERE source_ip = ?
                        ORDER BY id ASC
                        LIMIT 100
                        """,
                        (source_ip,),
                    )

                    alerts = _rows(
                        connection,
                        """
                        SELECT *
                        FROM security_alerts
                        WHERE source_ip = ?
                        ORDER BY id ASC
                        LIMIT 100
                        """,
                        (source_ip,),
                    )

                responses = _rows(
                    connection,
                    """
                    SELECT *
                    FROM response_actions
                    WHERE incident_id = ?
                    ORDER BY id ASC
                    LIMIT 100
                    """,
                    (int(incident_id),),
                )

        if incident is None:
            events = _rows(
                connection,
                "SELECT * FROM security_events ORDER BY id DESC LIMIT 50",
            )

            alerts = _rows(
                connection,
                "SELECT * FROM security_alerts ORDER BY id DESC LIMIT 50",
            )

            incidents = _rows(
                connection,
                "SELECT * FROM security_incidents ORDER BY id DESC LIMIT 20",
            )
        else:
            incidents = [incident]

        return {
            "incident": incident,
            "incidents": incidents,
            "events": events,
            "alerts": alerts,
            "responses": responses,
        }

    finally:
        connection.close()


def get_shield_context() -> Dict[str, Any]:
    try:
        from .shield import get_shield_status
        return get_shield_status()
    except Exception as exc:
        return {
            "engine": "AEGIS SHIELD",
            "protection_state": "UNKNOWN",
            "error": str(exc),
        }


def _compact(value: Any, limit: int = 18000) -> str:
    text = json.dumps(value, indent=2, default=str)

    if len(text) <= limit:
        return text

    return text[:limit] + "\n...[context truncated]"


def analyze_security_context(
    incident_id: Optional[int] = None,
    question: Optional[str] = None,
) -> Dict[str, Any]:

    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        return {
            "available": False,
            "engine": "AEGIS AI CORE",
            "model": MODEL,
            "error": "GEMINI_API_KEY is not configured in the backend environment.",
        }

    context = get_incident_context(incident_id)
    shield = get_shield_context()

    user_question = question or (
        "Analyze the supplied AEGIS X security context. "
        "Explain what is happening, why it matters, the strongest evidence, "
        "likely attack progression, uncertainty, and the next investigation steps."
    )

    prompt = f"""
AEGIS X SECURITY CONTEXT

USER QUESTION:
{user_question}

SELECTED INCIDENT:
{_compact(context.get("incident"))}

RELATED INCIDENTS:
{_compact(context.get("incidents"), 9000)}

SECURITY EVENTS:
{_compact(context.get("events"), 14000)}

SECURITY ALERTS:
{_compact(context.get("alerts"), 10000)}

RESPONSE HISTORY:
{_compact(context.get("responses"), 6000)}

AEGIS SHIELD STATUS:
{_compact(shield, 7000)}

Provide your security analysis using these sections:

## Assessment
A concise overall assessment.

## What Happened
Explain the observed activity chronologically.

## Evidence
List the strongest pieces of evidence and why they matter.

## Attack Progression
Describe the likely progression only where supported by evidence.

## Risk Explanation
Explain the observed risk level without inventing facts.

## MITRE Context
Discuss relevant ATT&CK techniques only when supported or clearly label them as contextual.

## Analyst Next Steps
Give practical, non-destructive investigation steps.

## Confidence & Uncertainty
State what is strongly supported and what remains uncertain.

## Response Safety
Remember that AEGIS X response execution is simulation-only.
"""

    try:
        client = genai.Client(api_key=api_key)

        response = None
        last_error = None
        used_model = MODEL

        for candidate_model in FALLBACK_MODELS:
            try:
                print(f"AEGIS AI: trying {candidate_model}")
                chat = client.chats.create(
                    model=candidate_model,
                    config=types.GenerateContentConfig(
                        system_instruction=SYSTEM_INSTRUCTION,
                        temperature=0.2,
                        max_output_tokens=1800
                    )
                )

                response = chat.send_message(prompt)
                used_model = candidate_model
                print(f"AEGIS AI: success with {candidate_model}")
                break
            except Exception as exc:
                last_error = exc
                print(f"AEGIS AI: {candidate_model} unavailable: {exc}")
                continue

        if response is None:
            raise RuntimeError(
                f"All Gemini models failed. Last error: {last_error}"
        )

        return {
            "available": True,
            "engine": "AEGIS AI CORE",
            "model": used_model,
            "mode": "GEMINI_SECURITY_ANALYST",
            "incident_id": incident_id,
            "question": user_question,
            "analysis": response.text or "No analysis returned.",
            "context_summary": {
                "events": len(context.get("events", [])),
                "alerts": len(context.get("alerts", [])),
                "incidents": len(context.get("incidents", [])),
                "responses": len(context.get("responses", [])),
                "shield_state": shield.get("protection_state"),
            },
        }

    except Exception as exc:
        return {
            "available": False,
            "engine": "AEGIS AI CORE",
            "model": used_model,
            "incident_id": incident_id,
            "error": str(exc),
        }
