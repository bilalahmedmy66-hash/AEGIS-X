from typing import Any, Dict

from .ai_core import get_incident_context, get_mitre_context
from .response import determine_response
from .shield import get_shield_status


def _text(value: Any) -> str:
    return str(value or "").strip()


def _int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except Exception:
        return default


def build_security_brain(incident_id: int) -> Dict[str, Any]:
    context = get_incident_context(incident_id)

    incident = context.get("incident") or {}
    events = context.get("events") or []
    alerts = context.get("alerts") or []
    responses = context.get("responses") or []

    if not incident:
        return {
            "brain": "AEGIS SECURITY BRAIN",
            "status": "NO_INCIDENT",
            "incident_id": incident_id,
            "message": "No incident evidence found.",
        }

    incident_type = _text(
        incident.get("incident_type")
        or incident.get("type")
        or "UNKNOWN"
    )

    risk_score = _int(
        incident.get("risk_score")
        or incident.get("risk")
        or 0
    )

    risk_level = _text(
        incident.get("risk_level")
        or incident.get("severity")
        or "UNKNOWN"
    ).upper()

    source_ip = _text(
        incident.get("source_ip")
        or incident.get("source")
        or "UNKNOWN"
    )

    event_types = [
        _text(
            event.get("event_type")
            or event.get("type")
            or "UNKNOWN"
        )
        for event in events
    ]

    alert_types = [
        _text(
            alert.get("alert_type")
            or alert.get("type")
            or "UNKNOWN"
        )
        for alert in alerts
    ]

    mitre = get_mitre_context(context)

    response = determine_response(
        risk_score=risk_score,
        risk_level=risk_level,
        incident_type=incident_type,
    )

    shield = get_shield_status()

    observed = []

    for event_type in event_types:
        if event_type and event_type not in observed:
            observed.append(event_type)

    for alert_type in alert_types:
        if alert_type and alert_type not in observed:
            observed.append(alert_type)

    attack_stage = "DETECTION"

    if incident_type in {
        "BRUTE_FORCE",
        "SUSPICIOUS_LOGIN",
    }:
        attack_stage = "INITIAL_ACCESS"

    elif incident_type == "PRIVILEGE_ESCALATION":
        attack_stage = "PRIVILEGE_ESCALATION"

    elif incident_type == "MALWARE_DETECTED":
        attack_stage = "COMPROMISE"

    elif incident_type == "FILE_MODIFIED":
        attack_stage = "EXECUTION"

    elif incident_type == "UNUSUAL_ACCESS":
        attack_stage = "ANOMALOUS_ACCESS"

    if risk_score >= 75:
        priority = "CRITICAL"
    elif risk_score >= 50:
        priority = "HIGH"
    elif risk_score >= 25:
        priority = "MEDIUM"
    else:
        priority = "LOW"

    # Evidence confidence is derived from available telemetry.
    # It measures how strongly the recorded evidence supports
    # the incident correlation, not whether malicious intent
    # or successful compromise occurred.

    existing_confidence = _int(
        incident.get("confidence"),
        0
    )

    event_types = [
        _text(event.get("event_type"))
        for event in events
        if event.get("event_type")
    ]

    alert_types = [
        _text(alert.get("alert_type"))
        for alert in alerts
        if alert.get("alert_type")
    ]

    unique_event_types = set(event_types)
    unique_alert_types = set(alert_types)

    evidence_confidence = 20

    if incident:
        evidence_confidence += 15

    if events:
        evidence_confidence += 20

    if alerts:
        evidence_confidence += 20

    if len(unique_event_types) >= 2:
        evidence_confidence += 10

    if len(unique_alert_types) >= 2:
        evidence_confidence += 10

    if source_ip and (
        context.get("incident") or
        context.get("events") or
        context.get("alerts")
    ):
        evidence_confidence += 5

    evidence_confidence = min(evidence_confidence, 100)

    confidence = max(existing_confidence, evidence_confidence)

    return {
        "brain": "AEGIS SECURITY BRAIN",
        "version": "1.0",
        "status": "ACTIVE",

        "incident": {
            "id": incident_id,
            "type": incident_type,
            "source_ip": source_ip,
            "risk_score": risk_score,
            "risk_level": risk_level,
            "priority": priority,
            "confidence": confidence,
        },

        "situation": {
            "state": "ACTIVE" if risk_score >= 25 else "MONITORING",
            "attack_stage": attack_stage,
            "event_count": len(events),
            "alert_count": len(alerts),
            "response_count": len([r for r in responses if int(r.get("incident_id", -1)) == incident_id]),
            "observed_signals": observed,
        },

        "evidence": {
            "observed": event_types + alert_types,
            "event_types": event_types,
            "alert_types": alert_types,
            "event_count": len(events),
            "alert_count": len(alerts),
        },

        "reasoning": {
            "evidence_driven": True,
            "incident_correlated": True,
            "source_correlated": bool(source_ip and source_ip != "UNKNOWN"),
            "intent": "UNKNOWN",
            "successful_compromise": "UNKNOWN",
        },

        "mitre": mitre,

        "response": {
            "recommended_action": response.get("action"),
            "risk_score": response.get("risk_score"),
            "risk_level": response.get("risk_level"),
            "mode": response.get("mode"),
            "real_execution": False,
        },

        "shield": {
            "state": shield.get("protection_state"),
            "mode": shield.get("mode"),
            "real_blocking": shield.get("real_blocking", False),
            "real_isolation": shield.get("real_isolation", False),
        },

        "analyst_actions": [
            "Validate the affected account or entity.",
            "Investigate the originating source.",
            "Determine whether additional assets show related activity.",
            "Review surrounding authentication and privilege telemetry.",
        ],

        "unknowns": [
            "Attacker intent is not established by telemetry alone.",
            "Successful compromise is not established unless supporting evidence exists.",
            "Persistence and lateral movement remain unknown without additional evidence.",
        ],
    }
