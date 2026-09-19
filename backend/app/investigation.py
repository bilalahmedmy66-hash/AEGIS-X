"""
AEGIS X - AI Investigation Engine

Phase 3.4

Generates an explainable analyst-style investigation from
AEGIS X security evidence.

This implementation is local and deterministic.
It does not require an external LLM or API key.
"""

from backend.app.attack_chain import build_attack_chain
from backend.app.graph import build_security_graph


def _severity_score(severity: str) -> int:
    values = {
        "LOW": 25,
        "MEDIUM": 50,
        "HIGH": 75,
        "CRITICAL": 100,
    }

    return values.get(str(severity).upper(), 0)


def _build_threat_assessment(incident, summary, mitre):
    severity = str(incident.get("severity", "UNKNOWN")).upper()
    risk_score = int(incident.get("risk_score") or 0)
    classification = summary.get(
        "classification",
        "Security Incident",
    )

    if risk_score >= 80 or severity == "CRITICAL":
        priority = "CRITICAL"
    elif risk_score >= 60 or severity == "HIGH":
        priority = "HIGH"
    elif risk_score >= 30 or severity == "MEDIUM":
        priority = "MEDIUM"
    else:
        priority = "LOW"

    if mitre.get("mapped"):
        technique = mitre["techniques"][0]
        technique_name = technique["name"]
        technique_id = technique["id"]
        tactic_name = technique["tactic"]

        assessment = (
            f"The incident is consistent with a {classification.lower()} "
            f"associated with MITRE ATT&CK technique "
            f"{technique_id} ({technique_name}) under the "
            f"{tactic_name} tactic."
        )
    else:
        assessment = (
            f"The incident is classified as {classification.lower()}, "
            "but no deterministic MITRE ATT&CK technique mapping "
            "was established."
        )

    return {
        "priority": priority,
        "severity": severity,
        "risk_score": risk_score,
        "classification": classification,
        "assessment": assessment,
    }


def _build_evidence(events, alerts, incident, summary):
    evidence = []

    source_ip = incident.get("source_ip")

    if events:
        evidence.append({
            "type": "EVENT_CORRELATION",
            "finding": (
                f"{len(events)} correlated security event(s) "
                "were identified."
            ),
            "strength": "STRONG",
        })

    if alerts:
        evidence.append({
            "type": "DETECTION_CORRELATION",
            "finding": (
                f"{len(alerts)} correlated detection alert(s) "
                "were generated."
            ),
            "strength": "STRONG",
        })

    if source_ip:
        evidence.append({
            "type": "SOURCE_CORRELATION",
            "finding": (
                f"Activity was correlated to source IP {source_ip}."
            ),
            "strength": "STRONG",
        })

    risk_score = int(incident.get("risk_score") or 0)

    if risk_score >= 60:
        evidence.append({
            "type": "RISK_ASSESSMENT",
            "finding": (
                f"Risk score reached {risk_score}, indicating "
                "elevated security risk."
            ),
            "strength": "STRONG",
        })

    if summary.get("confidence") is not None:
        evidence.append({
            "type": "CONFIDENCE",
            "finding": (
                f"Correlated evidence confidence is "
                f"{summary['confidence']}%."
            ),
            "strength": "MEDIUM",
        })

    return evidence


def _build_attack_narrative(incident, attack_chain, mitre):
    source_ip = incident.get("source_ip", "unknown source")
    event_count = len(attack_chain.get("events", []))
    alert_count = len(attack_chain.get("alerts", []))

    progression = attack_chain.get(
        "summary",
        {}
    ).get(
        "attack_progression",
        []
    )

    narrative = []

    narrative.append(
        f"AEGIS X observed {event_count} correlated security "
        f"event(s) associated with {source_ip}."
    )

    if alert_count:
        narrative.append(
            f"The activity generated {alert_count} correlated "
            "detection alert(s)."
        )

    if progression:
        narrative.append(
            "The observed attack progression was: "
            + " → ".join(progression)
            + "."
        )

    if mitre.get("mapped"):
        technique = mitre["techniques"][0]

        narrative.append(
            f"MITRE ATT&CK mapping identifies "
            f"{technique['id']} ({technique['name']}) "
            f"under {technique['tactic']}."
        )

    narrative.append(
        f"The incident currently has {incident.get('status', 'UNKNOWN')} "
        "status."
    )

    return narrative


def _build_recommendations(incident, attack_chain, mitre):
    recommendations = []

    source_ip = incident.get("source_ip")

    if source_ip:
        recommendations.append({
            "priority": "HIGH",
            "action": "Investigate source IP",
            "reason": (
                f"Review activity originating from {source_ip} "
                "across available security telemetry."
            ),
        })

    event_types = {
        str(event.get("event_type", "")).upper()
        for event in attack_chain.get("events", [])
    }

    if "LOGIN_FAILED" in event_types:
        recommendations.append({
            "priority": "HIGH",
            "action": "Review affected authentication activity",
            "reason": (
                "Repeated failed authentication events were "
                "observed."
            ),
        })

    if mitre.get("mapped"):
        technique = mitre["techniques"][0]

        recommendations.append({
            "priority": "MEDIUM",
            "action": f"Investigate MITRE technique {technique['id']}",
            "reason": (
                f"Evidence is associated with "
                f"{technique['name']}."
            ),
        })

    recommendations.append({
        "priority": "MEDIUM",
        "action": "Review authentication and system logs",
        "reason": (
            "Additional telemetry can establish whether the "
            "activity progressed beyond the detected behavior."
        ),
    })

    recommendations.append({
        "priority": "MEDIUM",
        "action": "Validate response effectiveness",
        "reason": (
            "Confirm that the simulated response or future "
            "operational response addresses the identified source."
        ),
    })

    return recommendations


def _build_conclusion(incident, summary, mitre):
    classification = summary.get(
        "classification",
        "Security Incident",
    )

    confidence = int(summary.get("confidence") or 0)
    risk_score = int(incident.get("risk_score") or 0)
    source_ip = incident.get("source_ip", "unknown source")

    if confidence >= 80:
        confidence_text = "strong"
    elif confidence >= 60:
        confidence_text = "moderate"
    else:
        confidence_text = "limited"

    if mitre.get("mapped"):
        technique = mitre["techniques"][0]

        return (
            f"AEGIS X assessed the activity from {source_ip} as a "
            f"{classification.lower()}. The evidence provides "
            f"{confidence_text} support for MITRE ATT&CK "
            f"{technique['id']} ({technique['name']}). "
            f"The incident has a risk score of {risk_score} and "
            f"should remain under analyst review until the activity "
            "is confirmed contained."
        )

    return (
        f"AEGIS X assessed the activity from {source_ip} as a "
        f"{classification.lower()} with a risk score of "
        f"{risk_score}. The evidence provides {confidence_text} "
        "support for the current assessment. Further telemetry "
        "should be reviewed before closing the incident."
    )


def build_ai_investigation(incident_id: int):
    """
    Build a complete analyst-style investigation.
    """

    attack_chain = build_attack_chain(incident_id)

    if attack_chain is None:
        return None

    incident = attack_chain["incident"]
    summary = attack_chain["summary"]
    mitre = attack_chain.get(
        "mitre_attack",
        {
            "mapped": False,
            "mapping_method": "deterministic_local",
            "tactics": [],
            "techniques": [],
        },
    )

    graph = build_security_graph(incident_id)

    events = attack_chain.get("events", [])
    alerts = attack_chain.get("alerts", [])

    threat_assessment = _build_threat_assessment(
        incident,
        summary,
        mitre,
    )

    evidence = _build_evidence(
        events,
        alerts,
        incident,
        summary,
    )

    attack_narrative = _build_attack_narrative(
        incident,
        attack_chain,
        mitre,
    )

    recommendations = _build_recommendations(
        incident,
        attack_chain,
        mitre,
    )

    conclusion = _build_conclusion(
        incident,
        summary,
        mitre,
    )

    return {
        "investigation": {
            "engine": "AEGIS X AI Investigation Engine",
            "version": "3.4",
            "mode": "local_explainable",
            "incident_id": incident_id,
        },

        "incident": incident,

        "threat_assessment": threat_assessment,

        "attack_story": {
            "classification": summary.get("classification"),
            "progression": summary.get(
                "attack_progression",
                []
            ),
            "narrative": attack_narrative,
        },

        "mitre_attack": mitre,

        "evidence": evidence,

        "confidence": {
            "score": summary.get("confidence", 0),
            "method": "correlated_security_evidence",
        },

        "recommendations": recommendations,

        "conclusion": conclusion,

        "graph": {
            "node_count": graph.get(
                "graph",
                {}
            ).get(
                "node_count",
                0,
            ),
            "edge_count": graph.get(
                "graph",
                {}
            ).get(
                "edge_count",
                0,
            ),
            "node_type_counts": graph.get(
                "graph",
                {}
            ).get(
                "node_type_counts",
                {},
            ),
        },

        "analysis": {
            "event_count": len(events),
            "alert_count": len(alerts),
            "attack_stage_count": attack_chain.get(
                "chain",
                {}
            ).get(
                "stage_count",
                0,
            ),
            "activity_count": attack_chain.get(
                "chain",
                {}
            ).get(
                "activity_count",
                0,
            ),
        },
    }
# Backward-compatible API name used by main.py
def build_investigation(incident_id: int):
    return build_ai_investigation(incident_id)