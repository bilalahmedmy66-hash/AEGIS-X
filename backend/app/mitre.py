"""
AEGIS X - MITRE ATT&CK Mapping Engine

Phase 3.3
Deterministic local mapping of detected attack behavior
to MITRE ATT&CK tactics and techniques.

This module does not call external APIs.
"""

BRUTE_FORCE_MAPPING = {
    "tactic_id": "TA0006",
    "tactic": "Credential Access",
    "technique_id": "T1110",
    "technique": "Brute Force",
}


def map_to_mitre(
    incident: dict,
    events: list,
    alerts: list,
    confidence: int = 0,
) -> dict:
    """
    Map correlated incident evidence to MITRE ATT&CK.

    The mapping is intentionally conservative and deterministic.
    """

    incident_type = str(
        incident.get("incident_type", "")
    ).upper()

    alert_types = {
        str(alert.get("alert_type", "")).upper()
        for alert in alerts
    }

    event_types = {
        str(event.get("event_type", "")).upper()
        for event in events
    }

    failed_login_count = sum(
        1
        for event in events
        if str(event.get("event_type", "")).upper() == "LOGIN_FAILED"
    )

    # Primary mapping:
    # BRUTE_FORCE -> T1110
    is_brute_force = (
        incident_type == "BRUTE_FORCE"
        or "BRUTE_FORCE" in alert_types
    )

    # Conservative secondary inference:
    # repeated LOGIN_FAILED events can support Brute Force.
    if not is_brute_force:
        is_brute_force = (
            "LOGIN_FAILED" in event_types
            and failed_login_count >= 3
        )

    if not is_brute_force:
        return {
            "mapped": False,
            "mapping_method": "deterministic_local",
            "tactics": [],
            "techniques": [],
        }

    confidence = max(0, min(100, int(confidence)))

    if failed_login_count:
        reason = (
            f"{failed_login_count} correlated failed authentication "
            "event(s) support the Brute Force technique."
        )
    else:
        reason = (
            "BRUTE_FORCE detection evidence was correlated with "
            "the incident."
        )

    return {
        "mapped": True,
        "mapping_method": "deterministic_local",
        "tactics": [
            {
                "id": BRUTE_FORCE_MAPPING["tactic_id"],
                "name": BRUTE_FORCE_MAPPING["tactic"],
            }
        ],
        "techniques": [
            {
                "id": BRUTE_FORCE_MAPPING["technique_id"],
                "name": BRUTE_FORCE_MAPPING["technique"],
                "tactic_id": BRUTE_FORCE_MAPPING["tactic_id"],
                "tactic": BRUTE_FORCE_MAPPING["tactic"],
                "confidence": confidence,
                "reason": reason,
            }
        ],
    }