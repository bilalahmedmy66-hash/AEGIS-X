from collections import Counter
from typing import Any


def analyze_events(events: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Analyze security events and identify simple threat patterns.
    """

    alerts = []

    # 1. Detect repeated failed logins
    failed_logins = [
        event
        for event in events
        if event.get("event_type") == "LOGIN_FAILED"
    ]

    failed_by_ip = Counter(
        event.get("source_ip")
        for event in failed_logins
        if event.get("source_ip")
    )

    for ip, count in failed_by_ip.items():
        if count >= 3:
            alerts.append({
                "type": "BRUTE_FORCE",
                "severity": "HIGH",
                "source_ip": ip,
                "message": f"{count} failed login attempts detected from {ip}",
            })

    # 2. Detect critical events
    for event in events:
        if event.get("severity", 0) >= 9:
            alerts.append({
                "type": "CRITICAL_EVENT",
                "severity": "CRITICAL",
                "source_ip": event.get("source_ip"),
                "message": event.get(
                    "description",
                    "Critical security event detected",
                ),
            })

    return {
        "total_events_analyzed": len(events),
        "alerts_generated": len(alerts),
        "alerts": alerts,
    }