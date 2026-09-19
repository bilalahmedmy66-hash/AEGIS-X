from fastapi import APIRouter, HTTPException
from typing import Any
import sqlite3

from backend.app.database import get_connection
from backend.app.response import determine_response, execute_response

router = APIRouter(prefix="/api/v1")


def _row_to_dict(row):
    if row is None:
        return None

    if hasattr(row, "keys"):
        return dict(row)

    return dict(row)


def _get_incident(incident_id: int):
    conn = get_connection()

    try:
        row = conn.execute(
            """
            SELECT
                id,
                incident_type,
                severity,
                risk_score,
                risk_level,
                source_ip,
                status,
                first_seen,
                last_seen
            FROM security_incidents
            WHERE id = ?
            """,
            (incident_id,),
        ).fetchone()

        return _row_to_dict(row)

    finally:
        conn.close()


@router.get("/incidents/{incident_id}/investigation")
def investigation(incident_id: int):

    incident = _get_incident(incident_id)

    if not incident:
        raise HTTPException(
            status_code=404,
            detail=f"Incident {incident_id} not found",
        )

    conn = get_connection()

    try:
        events = [
            _row_to_dict(row)
            for row in conn.execute(
                """
                SELECT *
                FROM security_events
                WHERE source_ip = ?
                ORDER BY timestamp ASC
                """,
                (incident["source_ip"],),
            ).fetchall()
        ]

        alerts = [
            _row_to_dict(row)
            for row in conn.execute(
                """
                SELECT *
                FROM security_alerts
                WHERE source_ip = ?
                ORDER BY created_at ASC
                """,
                (incident["source_ip"],),
            ).fetchall()
        ]

        responses = [
            _row_to_dict(row)
            for row in conn.execute(
                """
                SELECT *
                FROM response_actions
                WHERE incident_id = ?
                ORDER BY executed_at ASC
                """,
                (incident_id,),
            ).fetchall()
        ]

    finally:
        conn.close()

    return {
        "engine": "AEGIS X AI Investigation Engine",
        "version": "compatibility",
        "mode": "local_explainable",

        "incident": incident,

        "threat_assessment": {
            "risk_score": incident.get("risk_score"),
            "risk_level": incident.get("risk_level"),
            "incident_type": incident.get("incident_type"),
            "source_ip": incident.get("source_ip"),
            "status": incident.get("status"),
        },

        "evidence": {
            "events": events,
            "alerts": alerts,
            "responses": responses,
            "event_count": len(events),
            "alert_count": len(alerts),
            "response_count": len(responses),
        },

        "attack_story": {
            "narrative": [
                f"Incident {incident_id} was identified as {incident.get('incident_type')}.",
                f"Source {incident.get('source_ip')} generated correlated security activity.",
                f"AEGIS X correlated {len(events)} events and {len(alerts)} alerts.",
                f"Risk assessment: {incident.get('risk_level')} ({incident.get('risk_score')}).",
            ]
        },

        "recommendations": [
            "Review correlated security events.",
            "Review response actions associated with the incident.",
            "Validate the affected source before applying containment.",
        ],

        "conclusion": (
            f"AEGIS X identified {incident.get('incident_type')} "
            f"activity associated with {incident.get('source_ip')}."
        ),
    }


@router.get("/incidents/{incident_id}/auto-fix/preview")
def auto_fix_preview(incident_id: int):

    incident = _get_incident(incident_id)

    if not incident:
        raise HTTPException(
            status_code=404,
            detail=f"Incident {incident_id} not found",
        )

    response = determine_response(
        risk_score=incident["risk_score"],
        risk_level=incident["risk_level"],
        incident_type=incident["incident_type"],
    )

    return {
        "success": True,
        "preview": {
            "incident_id": incident_id,
            "incident_type": incident["incident_type"],
            "source_ip": incident["source_ip"],
            "risk_score": incident["risk_score"],
            "risk_level": incident["risk_level"],
            "recommended_action": response.get("action"),
            "execution_mode": response.get("mode", "SIMULATION"),
            "simulation_only": True,
            "requires_confirmation": True,
        },
    }


@router.post("/incidents/{incident_id}/auto-fix")
def auto_fix(incident_id: int):

    incident = _get_incident(incident_id)

    if not incident:
        raise HTTPException(
            status_code=404,
            detail=f"Incident {incident_id} not found",
        )

    response = determine_response(
        risk_score=incident["risk_score"],
        risk_level=incident["risk_level"],
        incident_type=incident["incident_type"],
    )

    execution = execute_response(
        incident_id=incident_id,
        action=response.get("action"),
        source_ip=incident["source_ip"],
    )

    return {
        "success": True,
        "incident": incident,
        "response": response,
        "execution": execution,
        "audit_verified": execution.get("id") is not None,
        "simulation_only": True,
    }


@router.get("/campaigns/{source_ip}")
def campaign(source_ip: str):

    conn = get_connection()

    try:
        incidents = [
            _row_to_dict(row)
            for row in conn.execute(
                """
                SELECT *
                FROM security_incidents
                WHERE source_ip = ?
                ORDER BY first_seen ASC
                """,
                (source_ip,),
            ).fetchall()
        ]

        events = [
            _row_to_dict(row)
            for row in conn.execute(
                """
                SELECT *
                FROM security_events
                WHERE source_ip = ?
                ORDER BY timestamp ASC
                """,
                (source_ip,),
            ).fetchall()
        ]

        alerts = [
            _row_to_dict(row)
            for row in conn.execute(
                """
                SELECT *
                FROM security_alerts
                WHERE source_ip = ?
                ORDER BY created_at ASC
                """,
                (source_ip,),
            ).fetchall()
        ]

    finally:
        conn.close()

    detection_types = sorted(
        set(
            str(item.get("incident_type"))
            for item in incidents
            if item.get("incident_type")
        )
    )

    max_risk = max(
        [
            int(item.get("risk_score") or 0)
            for item in incidents
        ] or [0]
    )

    if len(detection_types) >= 2:
        classification = "Multi-Stage Security Campaign"
    elif detection_types:
        classification = f"{detection_types[0]} Activity"
    else:
        classification = "No Active Campaign"

    return {
        "success": True,

        "campaign": {
            "source_ip": source_ip,
            "classification": classification,
            "risk_score": max_risk,
            "risk_level": (
                "CRITICAL" if max_risk >= 80
                else "HIGH" if max_risk >= 60
                else "MEDIUM" if max_risk >= 30
                else "LOW"
            ),
            "incident_count": len(incidents),
            "detection_count": len(detection_types),
            "detection_types": detection_types,
        },

        "incidents": incidents,
        "events": events,
        "alerts": alerts,
    }

