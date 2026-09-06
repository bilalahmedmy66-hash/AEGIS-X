from datetime import datetime, timezone
from typing import Any

from backend.app.database import get_connection


ALLOWED_STATUSES = {
    "OPEN",
    "ACKNOWLEDGED",
    "RESOLVED",
}


def create_incident(
    incident_type: str,
    severity: str,
    risk_score: int,
    risk_level: str,
    source_ip: str | None,
    description: str,
) -> int:
    connection = get_connection()

    cursor = connection.execute(
        """
        INSERT INTO security_incidents (
            incident_type,
            severity,
            risk_score,
            risk_level,
            source_ip,
            description,
            status,
            first_seen,
            last_seen
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            incident_type,
            severity,
            risk_score,
            risk_level,
            source_ip,
            description,
            "OPEN",
            datetime.now(timezone.utc).isoformat(),
            datetime.now(timezone.utc).isoformat(),
        ),
    )

    connection.commit()

    incident_id = cursor.lastrowid

    connection.close()

    return incident_id


def get_incidents() -> list[dict[str, Any]]:
    connection = get_connection()

    rows = connection.execute(
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
        ORDER BY id DESC
        """
    ).fetchall()

    connection.close()

    return [dict(row) for row in rows]


def find_open_incident(
    incident_type: str,
    source_ip: str | None,
) -> dict[str, Any] | None:
    connection = get_connection()

    row = connection.execute(
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
        WHERE incident_type = ?
          AND source_ip IS ?
          AND status != 'RESOLVED'
        ORDER BY id DESC
        LIMIT 1
        """,
        (
            incident_type,
            source_ip,
        ),
    ).fetchone()

    connection.close()

    if row is None:
        return None

    return dict(row)


def update_incident_status(
    incident_id: int,
    status: str,
) -> bool:
    if status not in ALLOWED_STATUSES:
        raise ValueError(
            f"Invalid status. Allowed statuses: "
            f"{sorted(ALLOWED_STATUSES)}"
        )

    connection = get_connection()

    cursor = connection.execute(
        """
        UPDATE security_incidents
        SET status = ?,
            last_seen = ?
        WHERE id = ?
        """,
        (
            status,
            datetime.now(timezone.utc).isoformat(),
            incident_id,
        ),
    )

    connection.commit()

    updated = cursor.rowcount > 0

    connection.close()

    return updated