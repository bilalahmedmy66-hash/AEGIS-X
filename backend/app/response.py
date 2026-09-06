from datetime import datetime, timezone
from typing import Any

from backend.app.database import get_connection


# -------------------------------------------------
# RESPONSE CONFIGURATION
# -------------------------------------------------

SIMULATION_MODE = True


ALLOWED_ACTIONS = {
    "MONITOR",
    "ALERT",
    "BLOCK_SOURCE",
    "ISOLATE_SOURCE",
}


# -------------------------------------------------
# RESPONSE DECISION ENGINE
# -------------------------------------------------

def determine_response(
    risk_score: int,
    risk_level: str,
    incident_type: str,
) -> dict[str, Any]:
    """
    Determine the appropriate defensive response.

    AEGIS-X currently operates in simulation mode.
    No real blocking, isolation, or network modification
    is performed.
    """

    if risk_score >= 75:
        action = "ISOLATE_SOURCE"

    elif risk_score >= 50:
        action = "BLOCK_SOURCE"

    elif risk_score >= 25:
        action = "ALERT"

    else:
        action = "MONITOR"

    return {
        "action": action,
        "risk_score": risk_score,
        "risk_level": risk_level,
        "incident_type": incident_type,
        "mode": (
            "SIMULATION"
            if SIMULATION_MODE
            else "ACTIVE"
        ),
    }


# -------------------------------------------------
# RESPONSE EXECUTION
# -------------------------------------------------

def execute_response(
    incident_id: int,
    action: str,
    source_ip: str | None = None,
) -> dict[str, Any]:
    """
    Execute a defensive response.

    Currently this function ONLY records the response
    in the database. It does not perform real blocking
    or isolation.
    """

    if action not in ALLOWED_ACTIONS:
        raise ValueError(
            "Invalid response action. "
            f"Allowed actions: {sorted(ALLOWED_ACTIONS)}"
        )

    executed_at = datetime.now(
        timezone.utc
    ).isoformat()

    connection = get_connection()

    cursor = connection.execute(
        """
        INSERT INTO response_actions (
            incident_id,
            action,
            source_ip,
            mode,
            status,
            executed_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            incident_id,
            action,
            source_ip,
            "SIMULATION",
            "SIMULATED",
            executed_at,
        ),
    )

    connection.commit()

    response_id = cursor.lastrowid

    connection.close()

    return {
        "response_id": response_id,
        "incident_id": incident_id,
        "action": action,
        "source_ip": source_ip,
        "mode": "SIMULATION",
        "status": "SIMULATED",
        "executed_at": executed_at,
    }


# -------------------------------------------------
# RESPONSE HISTORY
# -------------------------------------------------

def get_response_actions() -> list[dict[str, Any]]:
    """
    Return all recorded response actions.
    """

    connection = get_connection()

    rows = connection.execute(
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
        ORDER BY id DESC
        """
    ).fetchall()

    connection.close()

    return [
        dict(row)
        for row in rows
    ]