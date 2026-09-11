from collections import Counter

from backend.app.database import get_connection


def _row_to_dict(row):
    if row is None:
        return None

    return dict(row)


def _event_stage(event_type):
    value = (event_type or "").upper()

    if "SCAN" in value:
        return "RECONNAISSANCE"

    if "LOGIN_FAILED" in value:
        return "INITIAL_ACCESS"

    if "LOGIN_SUCCESS" in value:
        return "INITIAL_ACCESS"

    if "COMMAND" in value or "SHELL" in value:
        return "EXECUTION"

    if "PROCESS" in value:
        return "EXECUTION"

    if "PRIVILEGE" in value:
        return "PRIVILEGE_ESCALATION"

    if "FILE" in value or "DOWNLOAD" in value:
        return "COLLECTION"

    if "C2" in value or "OUTBOUND" in value:
        return "COMMAND_AND_CONTROL"

    return "ACTIVITY"


def _alert_stage(alert_type):
    value = (alert_type or "").upper()

    if "BRUTE_FORCE" in value:
        return "CREDENTIAL_ACCESS"

    if "SCAN" in value or "RECON" in value:
        return "RECONNAISSANCE"

    if "EXECUTION" in value:
        return "EXECUTION"

    if "PRIVILEGE" in value:
        return "PRIVILEGE_ESCALATION"

    if "EXFIL" in value:
        return "EXFILTRATION"

    if "C2" in value:
        return "COMMAND_AND_CONTROL"

    return "DETECTION"


def build_attack_chain(incident_id):
    """
    Build a read-only attack chain for an AEGIS X incident.
    """

    connection = get_connection()

    try:
        # ====================================================
        # INCIDENT
        # ====================================================

        incident_row = connection.execute(
            """
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
            WHERE id = ?
            """,
            (incident_id,),
        ).fetchone()

        if incident_row is None:
            return None

        incident = _row_to_dict(incident_row)
        source_ip = incident.get("source_ip")

        # ====================================================
        # EVENTS
        # ====================================================

        event_rows = connection.execute(
            """
            SELECT
                id,
                event_type,
                source,
                user,
                source_ip,
                description,
                severity,
                timestamp
            FROM security_events
            WHERE source_ip = ?
            ORDER BY timestamp ASC, id ASC
            """,
            (source_ip,),
        ).fetchall()

        events = [_row_to_dict(row) for row in event_rows]

        # ====================================================
        # ALERTS
        # ====================================================

        alert_rows = connection.execute(
            """
            SELECT
                id,
                alert_type,
                severity,
                risk_score,
                risk_level,
                source_ip,
                message,
                created_at,
                status
            FROM security_alerts
            WHERE source_ip = ?
            ORDER BY created_at ASC, id ASC
            """,
            (source_ip,),
        ).fetchall()

        alerts = [_row_to_dict(row) for row in alert_rows]

        # ====================================================
        # STAGE ACTIVITY
        # ====================================================

        stage_activity = []

        for event in events:
            stage_activity.append(
                {
                    "stage": _event_stage(
                        event.get("event_type")
                    ),
                    "source": "EVENT",
                    "id": event.get("id"),
                    "label": event.get("event_type"),
                    "timestamp": event.get("timestamp"),
                }
            )

        for alert in alerts:
            stage_activity.append(
                {
                    "stage": _alert_stage(
                        alert.get("alert_type")
                    ),
                    "source": "ALERT",
                    "id": alert.get("id"),
                    "label": alert.get("alert_type"),
                    "timestamp": alert.get("created_at"),
                }
            )

        # ====================================================
        # INCIDENT IMPACT
        # ====================================================

        stage_activity.append(
            {
                "stage": "IMPACT",
                "source": "INCIDENT",
                "id": incident.get("id"),
                "label": incident.get("incident_type"),
                "timestamp": incident.get("last_seen"),
            }
        )

        # ====================================================
        # STAGE COUNTS
        # ====================================================

        stage_counts = Counter(
            item["stage"]
            for item in stage_activity
        )

        stage_order = [
            "RECONNAISSANCE",
            "INITIAL_ACCESS",
            "CREDENTIAL_ACCESS",
            "EXECUTION",
            "PRIVILEGE_ESCALATION",
            "COLLECTION",
            "COMMAND_AND_CONTROL",
            "EXFILTRATION",
            "ACTIVITY",
            "DETECTION",
            "IMPACT",
        ]

        stages = []

        for stage_name in stage_order:
            count = stage_counts.get(stage_name, 0)

            if count > 0:
                stages.append(
                    {
                        "stage": stage_name,
                        "count": count,
                    }
                )

        # ====================================================
        # ANALYSIS
        # ====================================================

        timestamps = [
            item.get("timestamp")
            for item in stage_activity
            if item.get("timestamp")
        ]

        first_observed = (
            min(timestamps)
            if timestamps
            else None
        )

        unique_event_types = sorted(
            {
                event.get("event_type")
                for event in events
                if event.get("event_type")
            }
        )

        unique_alert_types = sorted(
            {
                alert.get("alert_type")
                for alert in alerts
                if alert.get("alert_type")
            }
        )

        primary_detection = (
            alerts[0].get("alert_type")
            if alerts
            else None
        )

        # ====================================================
        # RESULT
        # ====================================================

        return {
            "incident": incident,

            "source": {
                "ip": source_ip,
            },

            "chain": {
                "stages": stages,
                "stage_count": len(stages),
                "activity_count": len(stage_activity),
            },

            "summary": {
                "primary_detection": primary_detection,
                "risk_level": incident.get("risk_level"),
                "risk_score": incident.get("risk_score"),
                "attack_progression": [
                    stage["stage"]
                    for stage in stages
                ],
            },

            "events": events,

            "alerts": alerts,

            "stage_activity": stage_activity,

            "analysis": {
                "first_observed": first_observed,
                "event_count": len(events),
                "alert_count": len(alerts),
                "unique_event_types": unique_event_types,
                "unique_alert_types": unique_alert_types,
            },
        }

    finally:
        connection.close()