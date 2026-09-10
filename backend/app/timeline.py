from typing import Any

from backend.app.database import get_connection


def get_incident_timeline(incident_id: int) -> dict[str, Any] | None:
    """
    Build an investigation timeline for a security incident.

    Correlation path:

        EVENT
          ↓
        DETECTION
          ↓
        ALERT
          ↓
        INCIDENT
          ↓
        RESPONSE
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

        incident = dict(incident_row)

        source_ip = incident["source_ip"]
        incident_type = incident["incident_type"]

        timeline = []

        # ====================================================
        # SECURITY EVENTS
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
            WHERE source_ip IS ?
            ORDER BY timestamp ASC, id ASC
            """,
            (source_ip,),
        ).fetchall()

        for event_row in event_rows:
            event = dict(event_row)

            timeline.append(
                {
                    "type": "EVENT",
                    "id": event["id"],
                    "timestamp": event["timestamp"],
                    "title": event["event_type"],
                    "description": event["description"],
                    "severity": event["severity"],
                    "source": event["source"],
                    "user": event["user"],
                    "source_ip": event["source_ip"],
                }
            )

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
                status,
                created_at
            FROM security_alerts
            WHERE alert_type = ?
              AND source_ip IS ?
            ORDER BY created_at ASC, id ASC
            """,
            (
                incident_type,
                source_ip,
            ),
        ).fetchall()

        for alert_row in alert_rows:
            alert = dict(alert_row)

            timeline.append(
                {
                    "type": "ALERT",
                    "id": alert["id"],
                    "timestamp": alert["created_at"],
                    "title": alert["alert_type"],
                    "description": alert["message"],
                    "severity": alert["severity"],
                    "risk_score": alert["risk_score"],
                    "risk_level": alert["risk_level"],
                    "status": alert["status"],
                    "source_ip": alert["source_ip"],
                }
            )

        # ====================================================
        # INCIDENT CREATION
        # ====================================================

        timeline.append(
            {
                "type": "INCIDENT",
                "id": incident["id"],
                "timestamp": incident["first_seen"],
                "title": incident["incident_type"],
                "description": incident["description"],
                "severity": incident["severity"],
                "risk_score": incident["risk_score"],
                "risk_level": incident["risk_level"],
                "status": incident["status"],
                "source_ip": incident["source_ip"],
            }
        )

        # ====================================================
        # RESPONSE ACTIONS
        # ====================================================

        response_rows = connection.execute(
            """
            SELECT
                id,
                incident_id,
                action,
                source_ip,
                mode,
                status,
                executed_at
            FROM response_actions
            WHERE incident_id = ?
            ORDER BY executed_at ASC, id ASC
            """,
            (incident_id,),
        ).fetchall()

        for response_row in response_rows:
            response = dict(response_row)

            timeline.append(
                {
                    "type": "RESPONSE",
                    "id": response["id"],
                    "timestamp": response["executed_at"],
                    "title": response["action"],
                    "description": (
                        f"Response action {response['action']} "
                        f"executed in {response['mode']} mode."
                    ),
                    "source_ip": response["source_ip"],
                    "mode": response["mode"],
                    "status": response["status"],
                    "incident_id": response["incident_id"],
                }
            )

        # ====================================================
        # STATUS EVENTS
        # ====================================================

        timeline.append(
            {
                "type": "STATUS",
                "id": incident["id"],
                "timestamp": incident["last_seen"],
                "title": incident["status"],
                "description": (
                    f"Incident status is {incident['status']}."
                ),
                "status": incident["status"],
            }
        )

        # ====================================================
        # SORT COMPLETE TIMELINE
        # ====================================================

        timeline.sort(
            key=lambda item: (
                item.get("timestamp") or "",
                item.get("id") or 0,
            )
        )

        return {
            "incident": incident,
            "timeline": timeline,
            "timeline_count": len(timeline),
        }

    finally:
        connection.close()