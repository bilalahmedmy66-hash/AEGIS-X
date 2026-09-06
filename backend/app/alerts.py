from datetime import datetime, timezone
from typing import Any

from backend.app.database import get_connection


def create_alert(alert: dict[str, Any]) -> int:
    risk = alert.get("risk", {})

    connection = get_connection()

    cursor = connection.execute(
        """
        INSERT INTO security_alerts (
            alert_type,
            severity,
            risk_score,
            risk_level,
            source_ip,
            message,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            alert.get("type", "UNKNOWN"),
            alert.get("severity", "LOW"),
            risk.get("score", 0),
            risk.get("level", "LOW"),
            alert.get("source_ip"),
            alert.get("message", ""),
            datetime.now(timezone.utc).isoformat(),
        ),
    )

    connection.commit()

    alert_id = cursor.lastrowid

    connection.close()

    return alert_id


def find_active_alert(
    alert_type: str,
    source_ip: str | None,
) -> dict[str, Any] | None:
    connection = get_connection()

    row = connection.execute(
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
          AND status IN ('NEW', 'ACKNOWLEDGED')
        ORDER BY id DESC
        LIMIT 1
        """,
        (alert_type, source_ip),
    ).fetchone()

    connection.close()

    if row is None:
        return None

    return dict(row)


def get_alerts() -> list[dict[str, Any]]:
    connection = get_connection()

    rows = connection.execute(
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
        ORDER BY id DESC
        """
    ).fetchall()

    connection.close()

    return [dict(row) for row in rows]


def update_alert_status(alert_id: int, status: str) -> bool:
    allowed_statuses = {
        "NEW",
        "ACKNOWLEDGED",
        "RESOLVED",
    }

    if status not in allowed_statuses:
        raise ValueError(
            f"Invalid status. Allowed statuses: {sorted(allowed_statuses)}"
        )

    connection = get_connection()

    cursor = connection.execute(
        """
        UPDATE security_alerts
        SET status = ?
        WHERE id = ?
        """,
        (status, alert_id),
    )

    connection.commit()

    updated = cursor.rowcount > 0

    connection.close()

    return updated