import os
import json
import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional

from google import genai
from google.genai import types

from .mitre import map_to_mitre


BASE_DIR = Path(__file__).resolve().parents[1]
DB_PATH = BASE_DIR / "data" / "aegis.db"

MODEL = os.getenv("AEGIS_GEMINI_MODEL", "gemini-3.8-flash")

# Ordered for reliable academic/demo operation.
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

CORE ANALYTICAL RULES:

1. EVIDENCE FIRST
- Reason only from the supplied AEGIS X telemetry.
- Treat database records as the authoritative evidence.
- Never invent events, alerts, users, IP addresses, timestamps, commands,
  files, attack stages, or response actions.
- If required evidence is missing, explicitly state that it is unknown.

2. FACT VS INTERPRETATION
Classify important conclusions as:
- OBSERVED: directly present in telemetry.
- INFERRED: reasonable interpretation supported by multiple observations.
- UNKNOWN: not established by available evidence.

Never present an inference as an observed fact.

ADDITIONAL CLAIM DISCIPLINE:
- Do not describe activity as malicious, unauthorized, compromised,
  successful, or intentional unless the supplied telemetry explicitly
  establishes that fact.
- Prefer neutral descriptions such as suspicious, anomalous, detected,
  observed, or correlated when the evidence does not establish intent
  or success.
- Distinguish an attempted action from a confirmed successful action.
- Do not infer attacker intent from event type, severity, or risk score alone.
- Never use the word "unauthorized" unless the supplied telemetry explicitly
  establishes that the action was unauthorized.
- A privilege change, login attempt, detection, or alert must not be described
  as unauthorized solely because AEGIS classified it as suspicious or high risk.
- A detection or alert indicates that AEGIS identified a security condition;
  it does not automatically prove malicious intent or successful compromise.

3. INCIDENT REASONING
- Explain the selected incident first.
- Use its actual type, severity, risk score, source IP/entity,
  timestamps, and related telemetry when available.
- Correlate records only when the supplied evidence supports the relationship.
- Do not assume that all activity from the same source is automatically
  one attack.

4. ATTACK PROGRESSION
- Describe progression chronologically.
- Use actual timestamps, event types, alert types, and incident records.
- A single event does not prove a complete attack chain.
- Clearly identify missing stages.
- Do not manufacture lateral movement, persistence, execution,
  exfiltration, impact, or compromise.
- Distinguish attempted activity from confirmed successful activity.

5. RISK
- Explain the recorded AEGIS risk score and risk level.
- Connect risk to concrete telemetry.
- Do not create a different risk score.
- Do not exaggerate severity.
- A high risk score is an AEGIS assessment and does not by itself prove
  malicious intent or successful compromise.

6. MITRE ATT&CK
- AEGIS X has a deterministic local MITRE mapping engine.
- The supplied AEGIS MITRE result is authoritative for this analysis.
- Do not invent additional ATT&CK techniques.
- If AEGIS reports mapped=false, do NOT name a specific ATT&CK technique
  as supported.
- If a mapping exists, explain the supplied mapping and its evidence reason.
- You may discuss general ATT&CK context only without assigning a new
  technique ID.
- Never treat an incident name alone as proof of a technique.

7. UEBA / BEHAVIOR
- Discuss anomalous behavior only when supported by telemetry.
- Do not claim a behavioral baseline exists unless supplied.
- Do not infer user intent without evidence.
- Do not label normal or unusual behavior as malicious without supporting
  evidence.

8. RECOMMENDATIONS
- Provide practical, non-destructive analyst investigation steps.
- Recommendations must be connected to the evidence.
- Prioritize validation, scoping, correlation, and evidence collection.
- Never recommend bypassing security controls.

9. RESPONSE SAFETY
- AEGIS X is an academic cybersecurity prototype.
- Response actions are simulation-only.
- Never claim BLOCK_SOURCE or ISOLATE_SOURCE actually blocked or isolated
  anything.
- Never autonomously execute a destructive action.
- Clearly distinguish recommended, simulated, and observed responses.

10. WRITING STYLE
Write like a professional SOC/security analyst:
- concise
- evidence-driven
- technically precise
- chronological where appropriate
- easy for a human analyst to understand

Avoid generic cybersecurity filler.
Prefer concrete evidence from the supplied records.
"""


def _db() -> sqlite3.Connection:
    connection = sqlite3.connect(str(DB_PATH))
    connection.row_factory = sqlite3.Row
    return connection


def _rows(
    connection: sqlite3.Connection,
    query: str,
    params: tuple = (),
) -> List[Dict[str, Any]]:
    cursor = connection.execute(query, params)
    return [dict(row) for row in cursor.fetchall()]


def get_incident_context(
    incident_id: Optional[int] = None,
) -> Dict[str, Any]:

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
                """
                SELECT *
                FROM security_events
                ORDER BY id DESC
                LIMIT 50
                """,
            )

            alerts = _rows(
                connection,
                """
                SELECT *
                FROM security_alerts
                ORDER BY id DESC
                LIMIT 50
                """,
            )

            incidents = _rows(
                connection,
                """
                SELECT *
                FROM security_incidents
                ORDER BY id DESC
                LIMIT 20
                """,
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


def get_mitre_context(
    context: Dict[str, Any],
) -> Dict[str, Any]:

    incident = context.get("incident")

    if not incident:
        return {
            "mapped": False,
            "mapping_method": "deterministic_local",
            "tactics": [],
            "techniques": [],
        }

    try:

        confidence = incident.get("confidence", 0)

        try:
            confidence = int(confidence)
        except (TypeError, ValueError):
            confidence = 0

        return map_to_mitre(
            incident=incident,
            events=context.get("events", []),
            alerts=context.get("alerts", []),
            confidence=confidence,
        )

    except Exception as exc:

        return {
            "mapped": False,
            "mapping_method": "deterministic_local",
            "tactics": [],
            "techniques": [],
            "error": str(exc),
        }


def _compact(
    value: Any,
    limit: int = 18000,
) -> str:

    text = json.dumps(
        value,
        indent=2,
        default=str,
    )

    if len(text) <= limit:
        return text

    return text[:limit] + "\n...[context truncated]"


def _build_evidence_guidance(
    context: Dict[str, Any],
) -> str:

    incident = context.get("incident") or {}
    events = context.get("events") or []
    alerts = context.get("alerts") or []
    responses = context.get("responses") or []

    incident_type = incident.get(
        "incident_type",
        "UNKNOWN",
    )

    risk_score = incident.get(
        "risk_score",
        "UNKNOWN",
    )

    risk_level = incident.get(
        "risk_level",
        "UNKNOWN",
    )

    source_ip = incident.get(
        "source_ip",
        "UNKNOWN",
    )

    event_types = []

    for event in events:

        event_type = event.get("event_type")

        if event_type and event_type not in event_types:
            event_types.append(event_type)

    alert_types = []

    for alert in alerts:

        alert_type = alert.get("alert_type")

        if alert_type and alert_type not in alert_types:
            alert_types.append(alert_type)

    return f"""
EVIDENCE GUIDANCE

Selected incident:
- incident_type: {incident_type}
- risk_score: {risk_score}
- risk_level: {risk_level}
- source_ip: {source_ip}

Observed event types:
{json.dumps(event_types)}

Observed alert types:
{json.dumps(alert_types)}

Response records:
{len(responses)}

When explaining the incident:
- Prefer actual records above.
- Do not invent missing attack stages.
- If only one event family is present, do not claim a broader attack chain.
- If multiple event families exist, explain their relationship only when
  timestamps and records support it.
"""


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
            "error": (
                "GEMINI_API_KEY is not configured "
                "in the backend environment."
            ),
        }

    context = get_incident_context(incident_id)

    shield = get_shield_context()

    # Deterministic AEGIS MITRE mapping.
    # Gemini receives this result as authoritative context.
    mitre = get_mitre_context(context)

    user_question = question or (
        "Analyze the supplied AEGIS X security context. "
        "Explain what is happening, why it matters, "
        "the strongest evidence, the supported attack progression, "
        "uncertainty, and the next investigation steps."
    )

    evidence_guidance = _build_evidence_guidance(context)

    prompt = f"""
AEGIS X SECURITY CONTEXT

You are analyzing telemetry records supplied by the AEGIS X
academic cybersecurity prototype.

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

AEGIS DETERMINISTIC MITRE RESULT:
{_compact(mitre, 7000)}

{evidence_guidance}

MITRE INTERPRETATION RULE:

The AEGIS deterministic MITRE result above is authoritative.

If:

mapped = false

then write:

"No deterministic MITRE ATT&CK technique is currently mapped
by the AEGIS evidence engine for this incident."

You may explain that the observed behavior could have broader
security context, but DO NOT introduce a new MITRE technique ID.

If:

mapped = true

then use only the techniques supplied in the deterministic result.

Do not invent or add ATT&CK techniques.

ANALYSIS REQUIREMENTS:

Before writing the final answer, reason through:

1. What is directly observed?
2. Which records support the assessment?
3. What can reasonably be inferred from multiple records?
4. Which attack stages are actually evidenced?
5. Which stages remain unknown?
6. Why does the recorded risk score make sense based on telemetry?
7. What does the deterministic AEGIS MITRE engine report?
8. What should a human analyst investigate next?
9. What response actions are only simulated?

Do not turn a plausible security narrative into a confirmed fact.

Do not describe activity as malicious, unauthorized, compromised,
successful, or intentional unless the supplied telemetry explicitly
establishes that fact.

When evidence does not establish intent or success, use neutral terms
such as suspicious, anomalous, detected, observed, or correlated.

Distinguish attempted actions from confirmed successful actions.

Provide your security analysis using exactly these sections:

## Assessment

Give a concise analyst assessment.

State:
- incident type
- recorded severity/risk
- affected source/entity when available
- strongest evidence

Do not introduce facts absent from supplied telemetry.


## What Happened

Reconstruct the activity chronologically.

Use actual:
- timestamps
- event types
- alert types
- event IDs
- alert IDs
- incident ID
- source information

Separate directly observed activity from interpretation.


## Evidence

List the strongest evidence.

For every important evidence item:
- identify the record
- describe what it shows
- explain why it matters

Prefer concrete event IDs, alert IDs, incident IDs,
timestamps, source IPs, and recorded actions.


## Attack Progression

Describe the attack progression only where the evidence supports it.

For every claimed stage, identify the telemetry supporting that stage.

Use:

OBSERVED
Directly present in telemetry.

INFERRED
Reasonable interpretation supported by multiple observations.

UNKNOWN
Not established by the available evidence.

Do not manufacture missing attack stages.


## Risk Explanation

Explain the actual recorded risk score and risk level.

Connect the risk assessment to observed evidence.

Do not create a new risk score.

Do not exaggerate severity merely because an attack pattern is plausible.

A high risk score does not by itself prove malicious intent
or successful compromise.


## MITRE Context

Use ONLY the AEGIS deterministic MITRE result.

If mapped=false:

State that no deterministic MITRE ATT&CK technique
is currently mapped by the AEGIS evidence engine.

Do not provide an alternative technique ID.

If mapped=true:

List only the supplied tactic and technique mappings.

Explain their supplied evidence reason.

Clearly distinguish deterministic mapping from broader contextual interpretation.


## Analyst Next Steps

Give practical, non-destructive investigation steps.

Prioritize:
- source validation
- affected account/entity validation
- related telemetry
- temporal correlation
- scope determination
- additional evidence collection

Keep recommendations tied to observed evidence.


## Confidence & Uncertainty

Clearly separate:

HIGH CONFIDENCE
Directly supported by multiple telemetry records.

MODERATE CONFIDENCE
Supported by evidence but with meaningful gaps.

LOW CONFIDENCE
Plausible interpretation with insufficient evidence.

Explicitly identify important unknowns.


## Response Safety

State the current AEGIS SHIELD protection state when available.

State that AEGIS X response actions are SIMULATION-only.

Never claim that BLOCK_SOURCE or ISOLATE_SOURCE
actually blocked or isolated anything.

Distinguish:
- recommended action
- simulated action
- actual observed response record
"""

    response = None
    last_error = None
    used_model = MODEL

    try:

        client = genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(
                timeout=15000
            ),
        )

        for candidate_model in FALLBACK_MODELS:

            try:

                print(
                    f"AEGIS AI: trying {candidate_model}"
                )

                chat = client.chats.create(
                    model=candidate_model,
                    config=types.GenerateContentConfig(
                        system_instruction=SYSTEM_INSTRUCTION,
                        temperature=0.2,
                        max_output_tokens=4096,
                    ),
                )

                response = chat.send_message(prompt)

                used_model = candidate_model

                print(
                    f"AEGIS AI: success with {candidate_model}"
                )

                break

            except Exception as exc:

                last_error = exc

                print(
                    f"AEGIS AI: {candidate_model} unavailable: {exc}"
                )

                continue

        if response is None:

            raise RuntimeError(
                f"All Gemini models failed. "
                f"Last error: {last_error}"
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
                "events": len(
                    context.get("events", [])
                ),
                "alerts": len(
                    context.get("alerts", [])
                ),
                "incidents": len(
                    context.get("incidents", [])
                ),
                "responses": len(
                    context.get("responses", [])
                ),
                "shield_state": shield.get(
                    "protection_state"
                ),
                "mitre_mapped": mitre.get(
                    "mapped",
                    False,
                ),
                "mitre_techniques": len(
                    mitre.get("techniques", [])
                ),
            },
            "mitre_context": mitre,
        }

    except Exception as exc:

        return {
            "available": False,
            "engine": "AEGIS AI CORE",
            "model": used_model,
            "incident_id": incident_id,
            "error": str(exc),
        }