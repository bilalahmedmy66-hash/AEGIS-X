from typing import Any

from backend.app.database import get_connection


def build_security_graph(incident_id: int) -> dict[str, Any] | None:
    """
    Build a read-only security relationship graph for an incident.

    Relationship model:

        SOURCE
          ↓
        EVENT
          ↓
      DETECTION
          ↓
        ALERT
          ↓
         RISK
          ↓
       INCIDENT
          ↓
       RESPONSE
          ↓
        STATUS
    """

    connection = get_connection()

    try:
        # =========================================================
        # INCIDENT
        # =========================================================

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

        nodes: list[dict[str, Any]] = []
        edges: list[dict[str, Any]] = []

        node_ids: set[str] = set()

        # =========================================================
        # HELPERS
        # =========================================================

        def add_node(
            node_id: str,
            node_type: str,
            label: str,
            **metadata: Any,
        ) -> None:
            if node_id in node_ids:
                return

            node_ids.add(node_id)

            nodes.append(
                {
                    "id": node_id,
                    "type": node_type,
                    "label": label,
                    "metadata": metadata,
                }
            )

        def add_edge(
            source: str,
            target: str,
            relationship: str,
        ) -> None:
            edges.append(
                {
                    "source": source,
                    "target": target,
                    "relationship": relationship,
                }
            )

        # =========================================================
        # SOURCE
        # =========================================================

        source_node_id = f"source:{source_ip or 'unknown'}"

        add_node(
            source_node_id,
            "SOURCE",
            source_ip or "Unknown source",
            source_ip=source_ip,
        )

        # =========================================================
        # EVENTS
        # =========================================================

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

        event_node_ids: list[str] = []

        for event_row in event_rows:
            event = dict(event_row)

            event_node_id = f"event:{event['id']}"

            add_node(
                event_node_id,
                "EVENT",
                event["event_type"],
                event_id=event["id"],
                source=event["source"],
                user=event["user"],
                source_ip=event["source_ip"],
                description=event["description"],
                severity=event["severity"],
                timestamp=event["timestamp"],
            )

            add_edge(
                source_node_id,
                event_node_id,
                "GENERATED",
            )

            event_node_ids.append(event_node_id)

        # =========================================================
        # DETECTION
        # =========================================================

        detection_node_id = (
            f"detection:{incident_type}:{source_ip or 'unknown'}"
        )

        add_node(
            detection_node_id,
            "DETECTION",
            incident_type,
            detection_type=incident_type,
            source_ip=source_ip,
        )

        for event_node_id in event_node_ids:
            add_edge(
                event_node_id,
                detection_node_id,
                "CONTRIBUTED_TO",
            )

        # =========================================================
        # ALERTS
        # =========================================================

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

        alert_node_ids: list[str] = []

        for alert_row in alert_rows:
            alert = dict(alert_row)

            alert_node_id = f"alert:{alert['id']}"

            add_node(
                alert_node_id,
                "ALERT",
                alert["alert_type"],
                alert_id=alert["id"],
                severity=alert["severity"],
                risk_score=alert["risk_score"],
                risk_level=alert["risk_level"],
                source_ip=alert["source_ip"],
                status=alert["status"],
                message=alert["message"],
                timestamp=alert["created_at"],
            )

            add_edge(
                detection_node_id,
                alert_node_id,
                "CREATED_ALERT",
            )

            alert_node_ids.append(alert_node_id)

        # =========================================================
        # RISK
        # =========================================================

        risk_node_id = f"risk:{incident_id}"

        add_node(
            risk_node_id,
            "RISK",
            f"{incident['risk_score']} / {incident['risk_level']}",
            score=incident["risk_score"],
            level=incident["risk_level"],
            severity=incident["severity"],
        )

        for alert_node_id in alert_node_ids:
            add_edge(
                alert_node_id,
                risk_node_id,
                "EVALUATED",
            )

        # =========================================================
        # INCIDENT
        # =========================================================

        incident_node_id = f"incident:{incident_id}"

        add_node(
            incident_node_id,
            "INCIDENT",
            f"Incident #{incident_id}",
            incident_id=incident["id"],
            incident_type=incident["incident_type"],
            severity=incident["severity"],
            risk_score=incident["risk_score"],
            risk_level=incident["risk_level"],
            source_ip=incident["source_ip"],
            status=incident["status"],
            description=incident["description"],
        )

        add_edge(
            risk_node_id,
            incident_node_id,
            "ESCALATED_TO",
        )

        # =========================================================
        # RESPONSE
        # =========================================================

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

        response_node_ids: list[str] = []

        for response_row in response_rows:
            response = dict(response_row)

            response_node_id = f"response:{response['id']}"

            add_node(
                response_node_id,
                "RESPONSE",
                response["action"],
                response_id=response["id"],
                incident_id=response["incident_id"],
                source_ip=response["source_ip"],
                mode=response["mode"],
                status=response["status"],
                timestamp=response["executed_at"],
            )

            add_edge(
                incident_node_id,
                response_node_id,
                "TRIGGERED",
            )

            response_node_ids.append(response_node_id)

        # =========================================================
        # STATUS
        # =========================================================

        status_node_id = f"status:{incident_id}"

        add_node(
            status_node_id,
            "STATUS",
            incident["status"],
            status=incident["status"],
            timestamp=incident["last_seen"],
        )

        if response_node_ids:
            for response_node_id in response_node_ids:
                add_edge(
                    response_node_id,
                    status_node_id,
                    "RESULTED_IN",
                )
        else:
            add_edge(
                incident_node_id,
                status_node_id,
                "CURRENT_STATUS",
            )

        # =========================================================
        # SUMMARY
        # =========================================================

        node_type_counts: dict[str, int] = {}

        for node in nodes:
            node_type = node["type"]

            node_type_counts[node_type] = (
                node_type_counts.get(node_type, 0) + 1
            )

        return {
            "incident": incident,
            "graph": {
                "nodes": nodes,
                "edges": edges,
                "node_count": len(nodes),
                "edge_count": len(edges),
                "node_type_counts": node_type_counts,
            },
            "attack_story": {
                "source": source_ip,
                "detection": incident_type,
                "risk_score": incident["risk_score"],
                "risk_level": incident["risk_level"],
                "incident_id": incident_id,
                "incident_status": incident["status"],
                "responses": [
                    dict(row)
                    for row in response_rows
                ],
            },
        }

    finally:
        connection.close()