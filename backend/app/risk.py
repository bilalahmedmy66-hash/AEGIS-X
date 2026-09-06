from typing import Any


def calculate_risk(
    severity: int,
    alert_type: str | None = None,
    event_count: int = 1,
) -> dict[str, Any]:
    """
    Calculate a normalized AEGIS-X risk score from 0 to 100.
    """

    score = severity * 10

    if alert_type == "BRUTE_FORCE":
        score += 20

    if event_count >= 5:
        score += 10

    if event_count >= 10:
        score += 15

    score = min(score, 100)

    if score >= 75:
        level = "CRITICAL"
    elif score >= 50:
        level = "HIGH"
    elif score >= 25:
        level = "MEDIUM"
    else:
        level = "LOW"

    return {
        "score": score,
        "level": level,
    }