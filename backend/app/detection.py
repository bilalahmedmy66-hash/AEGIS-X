from collections import Counter
from typing import Any


def analyze_events(events: list[dict[str, Any]]) -> dict[str, Any]:
    """
    AEGIS X Detection Engine.

    Converts raw security events into logical security detections.
    Multiple events belonging to the same source and threat condition
    are grouped into a single detection.
    """

    alerts = []

    # =========================================================
    # 1. BRUTE FORCE
    # =========================================================
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
            severity = "CRITICAL" if count >= 5 else "HIGH"

            alerts.append({
                "type": "BRUTE_FORCE",
                "severity": severity,
                "source_ip": ip,
                "message": (
                    f"{count} failed login attempts detected "
                    f"from {ip}"
                ),
            })

    # =========================================================
    # 2. SUSPICIOUS LOGIN / IP
    # =========================================================
    suspicious_events = [
        event
        for event in events
        if event.get("event_type") == "SUSPICIOUS_IP"
    ]

    suspicious_by_ip = Counter(
        event.get("source_ip")
        for event in suspicious_events
        if event.get("source_ip")
    )

    for ip, count in suspicious_by_ip.items():
        if count >= 1:
            severity = "HIGH" if count >= 3 else "MEDIUM"

            alerts.append({
                "type": "SUSPICIOUS_LOGIN",
                "severity": severity,
                "source_ip": ip,
                "message": (
                    f"{count} suspicious login event(s) detected "
                    f"from {ip}"
                ),
            })

    # =========================================================
    # 3. PRIVILEGE ESCALATION
    # =========================================================
    privilege_events = [
        event
        for event in events
        if event.get("event_type") == "PRIVILEGE_CHANGE"
    ]

    privilege_by_ip = {}

    for event in privilege_events:
        ip = event.get("source_ip")

        if ip:
            privilege_by_ip.setdefault(ip, []).append(event)

    for ip, source_events in privilege_by_ip.items():
        count = len(source_events)

        alerts.append({
            "type": "PRIVILEGE_ESCALATION",
            "severity": "HIGH",
            "source_ip": ip,
            "message": (
                f"{count} privilege change event(s) detected "
                f"from {ip}"
            ),
        })

    # =========================================================
    # 4. MALWARE DETECTION
    # =========================================================
    malware_events = [
        event
        for event in events
        if event.get("event_type") == "MALWARE_DETECTED"
    ]

    malware_by_ip = {}

    for event in malware_events:
        ip = event.get("source_ip")

        if ip:
            malware_by_ip.setdefault(ip, []).append(event)

    for ip, source_events in malware_by_ip.items():
        count = len(source_events)

        alerts.append({
            "type": "MALWARE_DETECTED",
            "severity": "CRITICAL",
            "source_ip": ip,
            "message": (
                f"{count} malware detection event(s) "
                f"identified from {ip}"
            ),
        })

    # =========================================================
    # 5. FILE MODIFICATION
    # =========================================================
    file_events = [
        event
        for event in events
        if event.get("event_type") == "FILE_MODIFIED"
    ]

    file_by_ip = {}

    for event in file_events:
        ip = event.get("source_ip")

        if ip:
            file_by_ip.setdefault(ip, []).append(event)

    for ip, source_events in file_by_ip.items():
        count = len(source_events)

        alerts.append({
            "type": "SUSPICIOUS_FILE_MODIFICATION",
            "severity": "MEDIUM",
            "source_ip": ip,
            "message": (
                f"{count} suspicious file modification "
                f"event(s) detected from {ip}"
            ),
        })

    # =========================================================
    # 6. UNUSUAL ACCESS
    # =========================================================
    unusual_events = [
        event
        for event in events
        if event.get("event_type") == "UNUSUAL_ACCESS"
    ]

    unusual_by_ip = {}

    for event in unusual_events:
        ip = event.get("source_ip")

        if ip:
            unusual_by_ip.setdefault(ip, []).append(event)

    for ip, source_events in unusual_by_ip.items():
        count = len(source_events)

        alerts.append({
            "type": "UNUSUAL_ACCESS",
            "severity": "HIGH",
            "source_ip": ip,
            "message": (
                f"{count} unusual access event(s) "
                f"detected from {ip}"
            ),
        })

    # =========================================================
    # 7. CRITICAL EVENTS
    # =========================================================
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

    # =========================================================
    # FINAL RESULT
    # =========================================================
    return {
        "total_events_analyzed": len(events),
        "alerts_generated": len(alerts),
        "alerts": alerts,
    }
