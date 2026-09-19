from collections import defaultdict
from datetime import datetime, timezone, timedelta
from typing import Any

from backend.app.database import get_connection


CORRELATION_WINDOW_HOURS = 24


def _parse_timestamp(value: Any):
    if not value:
        return None

    if isinstance(value, datetime):
        parsed = value
    else:
        try:
            parsed = datetime.fromisoformat(
                str(value).replace("Z", "+00:00")
            )
        except Exception:
            return None

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)

    return parsed


def _row_to_dict(row):
    return dict(row) if row else None


def _risk_level(score: int) -> str:
    if score >= 80:
        return "CRITICAL"
    if score >= 50:
        return "HIGH"
    if score >= 30:
        return "MEDIUM"
    return "LOW"


def _attack_classification(types: list[str]) -> str:
    normalized = set(types)

    if "MALWARE_DETECTED" in normalized:
        return "Malware / Endpoint Compromise"

    if (
        "BRUTE_FORCE" in normalized
        or "SUSPICIOUS_LOGIN" in normalized
    ):
        if "PRIVILEGE_ESCALATION" in normalized:
            return "Credential Compromise with Privilege Escalation"
        return "Credential Attack"

    if "PRIVILEGE_ESCALATION" in normalized:
        return "Privilege Escalation"

    if "SUSPICIOUS_FILE_MODIFICATION" in normalized:
        return "Suspicious File Activity"

    if "UNUSUAL_ACCESS" in normalized:
        return "Anomalous Access"

    return "Multi-Signal Security Activity"


def _build_attack_progression(types: list[str]) -> list[str]:
    normalized = set(types)
    progression = []

    if (
        "BRUTE_FORCE" in normalized
        or "SUSPICIOUS_LOGIN" in normalized
    ):
        progression.append("INITIAL_ACCESS")

    if "PRIVILEGE_ESCALATION" in normalized:
        progression.append("PRIVILEGE_ESCALATION")

    if "SUSPICIOUS_FILE_MODIFICATION" in normalized:
        progression.append("EXECUTION")

    if "MALWARE_DETECTED" in normalized:
        progression.append("COMPROMISE")

    if "UNUSUAL_ACCESS" in normalized:
        progression.append("LATERAL_OR_ANOMALOUS_ACCESS")

    if len(progression) >= 2:
        progression.append("IMPACT")

    return progression


def _calculate_campaign_score(incidents: list[dict]) -> int:
    if not incidents:
        return 0

    highest = max(
        int(item.get("risk_score") or 0)
        for item in incidents
    )

    unique_types = {
        item.get("incident_type")
        for item in incidents
        if item.get("incident_type")
    }

    type_bonus = min(len(unique_types) * 10, 30)
    incident_bonus = min(len(incidents) * 5, 20)

    return min(
        100,
        highest + type_bonus + incident_bonus,
    )


def _split_into_time_windows(
    incidents: list[dict],
) -> list[list[dict]]:
    """
    Split incidents for one source into campaigns.

    A campaign may contain incidents only when consecutive
    activity remains within the configured correlation window.
    """

    if not incidents:
        return []

    ordered = sorted(
        incidents,
        key=lambda item: (
            _parse_timestamp(item.get("first_seen"))
            or datetime.min.replace(tzinfo=timezone.utc),
            item.get("id", 0),
        ),
    )

    windows = []
    current_window = []
    window_start = None

    correlation_delta = timedelta(
        hours=CORRELATION_WINDOW_HOURS
    )

    for incident in ordered:
        timestamp = _parse_timestamp(
            incident.get("first_seen")
        )

        if timestamp is None:
            continue

        if not current_window:
            current_window = [incident]
            window_start = timestamp
            continue

        if timestamp - window_start <= correlation_delta:
            current_window.append(incident)
        else:
            windows.append(current_window)
            current_window = [incident]
            window_start = timestamp

    if current_window:
        windows.append(current_window)

    return windows


def _build_campaign(source_ip: str, incidents: list[dict]):
    incident_types = [
        item.get("incident_type")
        for item in incidents
        if item.get("incident_type")
    ]

    unique_types = list(dict.fromkeys(incident_types))

    # A campaign requires either multiple incidents
    # or multiple distinct detection types.
    if len(incidents) < 2 and len(unique_types) < 2:
        return None

    campaign_score = _calculate_campaign_score(incidents)

    first_seen_values = [
        _parse_timestamp(item.get("first_seen"))
        for item in incidents
    ]
    first_seen_values = [
        value for value in first_seen_values
        if value is not None
    ]

    last_seen_values = [
        _parse_timestamp(item.get("last_seen"))
        for item in incidents
    ]
    last_seen_values = [
        value for value in last_seen_values
        if value is not None
    ]

    campaign_suffix = source_ip.replace(".", "-")

    if first_seen_values:
        campaign_suffix += "-"
        campaign_suffix += first_seen_values[0].strftime(
            "%Y%m%d%H%M%S"
        )

    return {
        "campaign_id": f"CAMPAIGN-{campaign_suffix}",
        "source_ip": source_ip,
        "classification": _attack_classification(
            unique_types
        ),
        "risk_score": campaign_score,
        "risk_level": _risk_level(campaign_score),
        "incident_count": len(incidents),
        "detection_count": len(unique_types),
        "detection_types": unique_types,
        "attack_progression": _build_attack_progression(
            unique_types
        ),
        "status": (
            "ACTIVE"
            if any(
                item.get("status") == "OPEN"
                for item in incidents
            )
            else "OBSERVED"
        ),
        "first_seen": (
            min(first_seen_values).isoformat()
            if first_seen_values
            else None
        ),
        "last_seen": (
            max(last_seen_values).isoformat()
            if last_seen_values
            else None
        ),
        "correlation": {
            "method": "SOURCE_IP_TIME_WINDOW",
            "window_hours": CORRELATION_WINDOW_HOURS,
        },
        "incidents": incidents,
    }


def build_correlation(source_ip: str | None = None):
    connection = get_connection()
    connection.row_factory = __import__("sqlite3").Row

    try:
        query = """
            SELECT
                id,
                incident_type,
                severity,
                risk_score,
                risk_level,
                source_ip,
                description,
                status,
                first_seen,
                last_seen
            FROM security_incidents
        """

        if source_ip:
            query += " WHERE source_ip = ?"
            query += " ORDER BY first_seen ASC, id ASC"

            rows = connection.execute(
                query,
                (source_ip,),
            ).fetchall()
        else:
            query += """
                WHERE source_ip IS NOT NULL
                ORDER BY source_ip, first_seen ASC, id ASC
            """

            rows = connection.execute(query).fetchall()

        incidents = [
            _row_to_dict(row)
            for row in rows
        ]

    finally:
        connection.close()

    grouped = defaultdict(list)

    for incident in incidents:
        ip = incident.get("source_ip")

        if ip:
            grouped[ip].append(incident)

    campaigns = []

    for ip, source_incidents in grouped.items():
        windows = _split_into_time_windows(
            source_incidents
        )

        for window in windows:
            campaign = _build_campaign(
                ip,
                window,
            )

            if campaign:
                campaigns.append(campaign)

    campaigns.sort(
        key=lambda item: (
            item.get("risk_score", 0),
            item.get("incident_count", 0),
        ),
        reverse=True,
    )

    return {
        "correlation_engine": {
            "name": "AEGIS X Attack Correlation Engine",
            "version": "1.1",
            "mode": "local_deterministic",
            "correlation_window_hours": (
                CORRELATION_WINDOW_HOURS
            ),
            "correlation_method": (
                "SOURCE_IP_TIME_WINDOW"
            ),
        },
        "summary": {
            "sources_analyzed": len(grouped),
            "campaigns_detected": len(campaigns),
            "active_campaigns": sum(
                1
                for campaign in campaigns
                if campaign["status"] == "ACTIVE"
            ),
        },
        "campaigns": campaigns,
    }


def build_source_correlation(source_ip: str):
    result = build_correlation(source_ip)

    return {
        **result,
        "source_ip": source_ip,
    }
