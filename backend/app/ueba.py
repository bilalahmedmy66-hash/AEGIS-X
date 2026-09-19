from datetime import datetime, timezone
from collections import defaultdict

from backend.app.database import get_connection


def _row_to_dict(row):
    return dict(row) if row is not None else None


def _parse_timestamp(value):
    if not value:
        return datetime.now(timezone.utc)

    try:
        text = str(value).replace("Z", "+00:00")
        parsed = datetime.fromisoformat(text)

        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)

        return parsed
    except Exception:
        return datetime.now(timezone.utc)


def _clamp(value, minimum=0, maximum=100):
    return max(minimum, min(maximum, int(value)))


def _risk_level(score):
    if score >= 80:
        return "CRITICAL"
    if score >= 60:
        return "HIGH"
    if score >= 35:
        return "MEDIUM"
    return "LOW"


def _entity_key(event, entity_type):
    if entity_type == "SOURCE_IP":
        return event.get("source_ip")

    if entity_type == "USERNAME":
        return event.get("username")

    if entity_type == "HOSTNAME":
        return event.get("hostname")

    return None


def _entity_label(event, entity_type):
    value = _entity_key(event, entity_type)

    if value:
        return str(value)

    return "unknown"


def _is_failed_auth(event):
    event_type = str(
        event.get("event_type")
        or event.get("event_name")
        or ""
    ).upper()

    description = str(
        event.get("description")
        or ""
    ).upper()

    return (
        "LOGIN_FAILED" in event_type
        or "AUTH_FAILED" in event_type
        or "FAILED_LOGIN" in event_type
        or "FAILED AUTH" in description
        or "LOGIN FAILED" in description
    )


def _get_events():
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT *
            FROM security_events
            ORDER BY timestamp ASC, id ASC
            """
        )

        rows = cursor.fetchall()

        return [_row_to_dict(row) for row in rows]

    finally:
        connection.close()


def _analyze_entity(events, entity_type, entity_value):
    relevant_events = [
        event
        for event in events
        if _entity_key(event, entity_type) == entity_value
    ]

    relevant_events.sort(
        key=lambda event: (
            _parse_timestamp(event.get("timestamp")),
            int(event.get("id", 0))
        )
    )

    event_count = len(relevant_events)

    if event_count == 0:
        return None

    failed_auth_count = sum(
        1 for event in relevant_events
        if _is_failed_auth(event)
    )

    failure_rate = (
        failed_auth_count / event_count
        if event_count
        else 0
    )

    max_burst = 1

    for index, event in enumerate(relevant_events):
        current_time = _parse_timestamp(event.get("timestamp"))
        burst_count = 1

        for next_event in relevant_events[index + 1:]:
            next_time = _parse_timestamp(next_event.get("timestamp"))

            difference = (
                next_time - current_time
            ).total_seconds()

            if difference <= 300:
                burst_count += 1
            else:
                break

        max_burst = max(max_burst, burst_count)

    # Frequency signal
    if event_count >= 20:
        frequency_score = 40
    elif event_count >= 10:
        frequency_score = 30
    elif event_count >= 5:
        frequency_score = 20
    elif event_count >= 3:
        frequency_score = 12
    else:
        frequency_score = 5

    # Authentication signal
    if failed_auth_count >= 10:
        auth_score = 35
    elif failed_auth_count >= 5:
        auth_score = 28
    elif failed_auth_count >= 3:
        auth_score = 22
    elif failed_auth_count == 2:
        auth_score = 14
    elif failed_auth_count == 1:
        auth_score = 5
    else:
        auth_score = 0

    # Burst signal
    if max_burst >= 20:
        burst_score = 30
    elif max_burst >= 10:
        burst_score = 25
    elif max_burst >= 5:
        burst_score = 20
    elif max_burst >= 3:
        burst_score = 15
    elif max_burst == 2:
        burst_score = 8
    else:
        burst_score = 0

    # Failure-rate signal
    if failure_rate >= 0.90:
        failure_rate_score = 18
    elif failure_rate >= 0.70:
        failure_rate_score = 14
    elif failure_rate >= 0.50:
        failure_rate_score = 9
    elif failure_rate > 0:
        failure_rate_score = 4
    else:
        failure_rate_score = 0

    score = _clamp(
        frequency_score
        + auth_score
        + burst_score
        + failure_rate_score
    )

    risk_level = _risk_level(score)

    if score <= 20:
        baseline_status = "NORMAL"
    elif score <= 50:
        baseline_status = "ELEVATED"
    else:
        baseline_status = "ABNORMAL"

    reasons = []

    if event_count >= 3:
        reasons.append(
            f"{event_count} events were observed for this entity."
        )

    if failed_auth_count > 0:
        reasons.append(
            f"{failed_auth_count} failed authentication event(s) were detected."
        )

    if max_burst >= 3:
        reasons.append(
            f"A burst of {max_burst} events occurred within five minutes."
        )

    if failure_rate >= 0.50:
        reasons.append(
            f"Authentication failure rate reached {failure_rate:.0%}."
        )

    if not reasons:
        reasons.append(
            "No strong behavioral anomaly signals were detected."
        )

    signal_count = sum(
        [
            event_count >= 3,
            failed_auth_count > 0,
            max_burst >= 3,
            failure_rate >= 0.50,
        ]
    )

    confidence = _clamp(
        50 + signal_count * 10
    )

    return {
        "entity": {
            "type": entity_type,
            "value": entity_value,
            "label": _entity_label(
                relevant_events[0],
                entity_type
            )
        },
        "behavior": {
            "event_count": event_count,
            "failed_auth_count": failed_auth_count,
            "failure_rate": round(failure_rate, 4),
            "max_5_minute_burst": max_burst
        },
        "signals": {
            "frequency_score": frequency_score,
            "authentication_score": auth_score,
            "burst_score": burst_score,
            "failure_rate_score": failure_rate_score
        },
        "score": score,
        "risk_level": risk_level,
        "baseline_status": baseline_status,
        "deviation": {
            "score": score,
            "description": (
                f"Behavioral deviation score is {score}/100."
            )
        },
        "reasons": reasons,
        "confidence": confidence,
        "events": relevant_events
    }


def analyze_ueba():
    events = _get_events()

    entity_types = [
        "SOURCE_IP",
        "USERNAME",
        "HOSTNAME"
    ]

    entities = []

    for entity_type in entity_types:
        values = sorted(
            {
                _entity_key(event, entity_type)
                for event in events
                if _entity_key(event, entity_type)
            }
        )

        for value in values:
            result = _analyze_entity(
                events,
                entity_type,
                value
            )

            if result:
                entities.append(result)

    entities.sort(
        key=lambda item: (
            item["score"],
            item["behavior"]["event_count"]
        ),
        reverse=True
    )

    risk_counts = {
        "CRITICAL": 0,
        "HIGH": 0,
        "MEDIUM": 0,
        "LOW": 0
    }

    for entity in entities:
        risk = entity["risk_level"]

        if risk in risk_counts:
            risk_counts[risk] += 1

    anomalous_entities = [
        entity
        for entity in entities
        if entity["baseline_status"] == "ABNORMAL"
    ]

    return {
        "ueba": {
            "engine": "AEGIS X UEBA Engine",
            "version": "1.0",
            "mode": "local_deterministic",
            "description": (
                "Behavioral analytics engine that evaluates "
                "frequency, authentication failures, bursts, "
                "and behavioral deviation."
            )
        },
        "summary": {
            "events_analyzed": len(events),
            "entities_analyzed": len(entities),
            "anomalous_entities": len(anomalous_entities),
            "risk_counts": risk_counts
        },
        "entities": entities
    }


def analyze_incident_ueba(incident_id):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT *
            FROM security_incidents
            WHERE id = ?
            """,
            (incident_id,)
        )

        incident_row = cursor.fetchone()

        if incident_row is None:
            return None

        incident = _row_to_dict(incident_row)

    finally:
        connection.close()

    source_ip = incident.get("source_ip")

    events = _get_events()

    correlated_events = [
        event
        for event in events
        if source_ip
        and event.get("source_ip") == source_ip
    ]

    entity_result = _analyze_entity(
        events,
        "SOURCE_IP",
        source_ip
    )

    return {
        "ueba": {
            "engine": "AEGIS X UEBA Engine",
            "version": "1.0",
            "mode": "local_deterministic",
            "incident_id": incident_id
        },
        "incident": incident,
        "entity": entity_result,
        "correlation": {
            "source_ip": source_ip,
            "correlated_event_count": len(correlated_events)
        }
    }
