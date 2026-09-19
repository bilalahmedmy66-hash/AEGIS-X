from collections import Counter
from backend.app.database import get_connection
from backend.app.mitre import map_to_mitre


EVENT_TYPE_TO_DETECTION = {
    "LOGIN_FAILED": "BRUTE_FORCE",
    "SUSPICIOUS_IP": "SUSPICIOUS_LOGIN",
    "PRIVILEGE_CHANGE": "PRIVILEGE_ESCALATION",
    "MALWARE_DETECTED": "MALWARE_DETECTED",
    "FILE_MODIFIED": "SUSPICIOUS_FILE_MODIFICATION",
    "UNUSUAL_ACCESS": "UNUSUAL_ACCESS",
}


def _row_to_dict(row):
    return dict(row) if row else None


def _event_matches_incident(event, incident_type):
    expected_detection = EVENT_TYPE_TO_DETECTION.get(
        event.get("event_type")
    )

    return expected_detection == incident_type


def _event_stage(event):
    event_type = event.get("event_type")

    mapping = {
        "LOGIN_FAILED": "INITIAL_ACCESS",
        "SUSPICIOUS_IP": "INITIAL_ACCESS",
        "PRIVILEGE_CHANGE": "PRIVILEGE_ESCALATION",
        "MALWARE_DETECTED": "COMPROMISE",
        "FILE_MODIFIED": "EXECUTION",
        "UNUSUAL_ACCESS": "LATERAL_OR_ANOMALOUS_ACCESS",
        "LOGIN_SUCCESS": "ACTIVITY",
    }

    return mapping.get(event_type, "ACTIVITY")


def _alert_stage(alert_type):
    mapping = {
        "BRUTE_FORCE": "CREDENTIAL_ACCESS",
        "SUSPICIOUS_LOGIN": "INITIAL_ACCESS",
        "PRIVILEGE_ESCALATION": "PRIVILEGE_ESCALATION",
        "MALWARE_DETECTED": "COMPROMISE",
        "SUSPICIOUS_FILE_MODIFICATION": "EXECUTION",
        "UNUSUAL_ACCESS": "LATERAL_OR_ANOMALOUS_ACCESS",
        "CRITICAL_EVENT": "IMPACT",
    }

    return mapping.get(alert_type, "DETECTION")


def _classify_attack(incident_type):
    mapping = {
        "BRUTE_FORCE": "Credential Attack",
        "SUSPICIOUS_LOGIN": "Suspicious Security Activity",
        "PRIVILEGE_ESCALATION": "Privilege Escalation",
        "MALWARE_DETECTED": "Malware / Endpoint Compromise",
        "SUSPICIOUS_FILE_MODIFICATION": "Suspicious File Activity",
        "UNUSUAL_ACCESS": "Anomalous Access",
        "CRITICAL_EVENT": "Critical Security Event",
    }

    return mapping.get(
        incident_type,
        "Security Incident",
    )


def _calculate_confidence(
    event_count,
    alert_count,
    incident,
):
    score = 40

    if event_count >= 2:
        score += 15

    if event_count >= 3:
        score += 10

    if alert_count >= 1:
        score += 10

    if alert_count >= 2:
        score += 5

    if incident.get("source_ip"):
        score += 5

    if incident.get("severity") == "HIGH":
        score += 5

    if incident.get("severity") == "CRITICAL":
        score += 10

    return min(score, 100)


def _build_reasoning(
    incident,
    events,
    alerts,
    confidence,
    classification,
):
    source_ip = incident.get("source_ip")

    factors = []

    if len(events) >= 2:
        factors.append(
            "Multiple correlated security events were observed."
        )

    if alerts:
        factors.append(
            "Security detection alerts were generated."
        )

    if source_ip:
        factors.append(
            "Activity is correlated to a specific source IP."
        )

    if int(incident.get("risk_score") or 0) >= 50:
        factors.append(
            "The calculated risk score is high."
        )
    else:
        factors.append(
            "The calculated risk score indicates elevated risk."
        )

    if incident.get("severity"):
        factors.append(
            f"Incident severity is {incident['severity']}."
        )

    explanation = [
        f"{len(events)} event(s) were correlated to this incident.",
        f"{len(alerts)} detection alert(s) matched this incident.",
    ]

    if source_ip:
        explanation.append(
            f"Activity is associated with source IP {source_ip}."
        )

    explanation.append(
        f"Risk score reached {incident.get('risk_score')} "
        f"({incident.get('risk_level')})."
    )

    explanation.append(
        f"Incident status is {incident.get('status')}."
    )

    explanation.append(
        f"AEGIS X classified the activity as "
        f"'{classification}'."
    )

    explanation.append(
        f"Evidence confidence score: {confidence}%."
    )

    return {
        "confidence": confidence,
        "classification": classification,
        "factors": factors,
        "explanation": explanation,
    }


def build_attack_chain(incident_id: int):
    connection = get_connection()
    connection.row_factory = __import__("sqlite3").Row

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

    incident = _row_to_dict(incident_row)

    if not incident:
        connection.close()
        return None

    incident_type = incident.get("incident_type")
    source_ip = incident.get("source_ip")

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

    all_events = [
        _row_to_dict(row)
        for row in event_rows
    ]

    events = [
        event
        for event in all_events
        if _event_matches_incident(
            event,
            incident_type,
        )
    ]

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
          AND alert_type = ?
        ORDER BY created_at ASC, id ASC
        """,
        (
            source_ip,
            incident_type,
        ),
    ).fetchall()

    alerts = [
        _row_to_dict(row)
        for row in alert_rows
    ]

    response_rows = connection.execute(
    	"""
    	SELECT
        	id,
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

    responses = [
        _row_to_dict(row)
        for row in response_rows
    ]

    connection.close()

    stage_activity = []

    for event in events:
        stage_activity.append(
            {
                "stage": _event_stage(event),
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

    stage_activity.append(
        {
            "stage": "IMPACT",
            "source": "INCIDENT",
            "id": incident.get("id"),
            "label": incident.get("incident_type"),
            "timestamp": incident.get("last_seen"),
        }
    )

    stage_counts = Counter(
        item["stage"]
        for item in stage_activity
    )

    stage_order = [
        "INITIAL_ACCESS",
        "CREDENTIAL_ACCESS",
        "PRIVILEGE_ESCALATION",
        "EXECUTION",
        "COMPROMISE",
        "LATERAL_OR_ANOMALOUS_ACCESS",
        "IMPACT",
    ]

    ordered_stages = [
        {
            "stage": stage,
            "count": stage_counts[stage],
        }
        for stage in stage_order
        if stage_counts[stage] > 0
    ]

    confidence = _calculate_confidence(
        len(events),
        len(alerts),
        incident,
    )

    classification = _classify_attack(
        incident_type
    )

    mitre_attack = map_to_mitre(
    	incident=incident,
    	events=events,
    	alerts=alerts,
    	confidence=confidence,
)

    return {
        "incident": incident,

        "source": {
            "ip": source_ip,
        },

        "chain": {
            "stages": ordered_stages,
            "stage_count": len(ordered_stages),
            "activity_count": len(stage_activity),
        },

        "summary": {
            "primary_detection": incident_type,
            "classification": classification,
            "risk_level": incident.get("risk_level"),
            "risk_score": incident.get("risk_score"),
            "confidence": confidence,
            "attack_progression": [
                item["stage"]
                for item in ordered_stages
            ],
        },

        "reasoning": _build_reasoning(
            incident,
            events,
            alerts,
            confidence,
            classification,
        ),

        "events": events,
        "alerts": alerts,
        "responses": responses,
        "stage_activity": stage_activity,
        "mitre_attack": mitre_attack,

        "analysis": {
            "first_observed": (
                events[0].get("timestamp")
                if events
                else incident.get("first_seen")
            ),
            "event_count": len(events),
            "alert_count": len(alerts),
            "response_count": len(responses),
            "unique_event_types": list(
                dict.fromkeys(
                    event.get("event_type")
                    for event in events
                    if event.get("event_type")
                )
            ),
            "unique_alert_types": list(
                dict.fromkeys(
                    alert.get("alert_type")
                    for alert in alerts
                    if alert.get("alert_type")
                )
            ),
        },
    }
