from typing import Any, Dict

from backend.app.database import get_db_connection
from backend.app.response import determine_response, execute_response


def get_incident(incident_id: int):
    conn = get_db_connection()

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

    conn.close()

    if not row:
        return None

    return dict(row)


def build_remediation_plan(incident: Dict[str, Any]):
    response = determine_response(
        risk_score=incident["risk_score"],
        risk_level=incident["risk_level"],
        incident_type=incident["incident_type"],
    )

    action = response.get("action", "NO_ACTION")
    mode = response.get("mode", "SIMULATION")

    return {
        "incident_id": incident["id"],
        "incident_type": incident["incident_type"],
        "source_ip": incident["source_ip"],
        "risk_score": incident["risk_score"],
        "risk_level": incident["risk_level"],
        "recommended_action": action,
        "execution_mode": mode,
        "requires_confirmation": True,
        "simulation_only": True,
        "steps": [
            "Validate incident evidence",
            "Select response action",
            "Execute response in simulation mode",
            "Verify response audit record",
            "Return remediation result",
        ],
    }


def execute_auto_fix(incident_id: int):
    incident = get_incident(incident_id)

    if not incident:
        raise ValueError(f"Incident {incident_id} not found")

    plan = build_remediation_plan(incident)

    execution = execute_response(
        incident_id=incident["id"],
        action=plan["recommended_action"],
        source_ip=incident["source_ip"],
        mode=plan["execution_mode"],
    )

    execution_id = execution.get("id")

    audit_verified = False

    if execution_id is not None:
        conn = get_db_connection()

        row = conn.execute(
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
            WHERE id = ?
            """,
            (execution_id,),
        ).fetchone()

        conn.close()

        audit_verified = row is not None

    return {
        "success": True,
        "incident": incident,
        "plan": plan,
        "execution": execution,
        "audit_verified": audit_verified,
        "verification": {
            "execution_record_created": execution_id is not None,
            "audit_record_found": audit_verified,
            "simulation_only": True,
        },
    }
