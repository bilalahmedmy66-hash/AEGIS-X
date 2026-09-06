from typing import Any


RESPONSE_ACTIONS = {
    "LOW": "MONITOR",
    "MEDIUM": "MONITOR",
    "HIGH": "BLOCK_SOURCE",
    "CRITICAL": "ISOLATE_HOST",
}


def determine_response(
    risk_score: int,
    risk_level: str,
    incident_type: str,
) -> dict[str, Any]:
    """
    Determine a safe, explainable response action
    based on the incident risk.
    """

    normalized_level = risk_level.upper()

    action = RESPONSE_ACTIONS.get(
        normalized_level,
        "MONITOR",
    )

    if incident_type == "BRUTE_FORCE":
        if normalized_level in {"HIGH", "CRITICAL"}:
            action = "BLOCK_SOURCE"

    return {
        "action": action,
        "risk_score": risk_score,
        "risk_level": normalized_level,
        "incident_type": incident_type,
        "mode": "SIMULATION",
    }