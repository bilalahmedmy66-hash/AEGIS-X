from fastapi import APIRouter
from backend.app.database import get_connection

telemetry_router = APIRouter(
    prefix="/api/v1/telemetry",
    tags=["Multi-Source Telemetry"],
)

@telemetry_router.get("/sources")
def telemetry_sources():
    connection = get_connection()
    try:
        rows = connection.execute(
            """
            SELECT
                source,
                COUNT(*) AS event_count,
                MAX(timestamp) AS last_seen
            FROM security_events
            GROUP BY source
            ORDER BY event_count DESC, source ASC
            """
        ).fetchall()

        return {
            "total_sources": len(rows),
            "sources": [
                {
                    "source": row["source"],
                    "event_count": row["event_count"],
                    "last_seen": row["last_seen"],
                }
                for row in rows
            ],
        }
    finally:
        connection.close()

@telemetry_router.post("/ingest")
def ingest_telemetry(record):
    from backend.app.telemetry import normalize_telemetry
    event = normalize_telemetry(record)
    connection = get_connection()
    try:
        cursor = connection.execute(
            """
            INSERT INTO security_events (
                event_type, source, user, source_ip,
                description, severity, timestamp
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                event.event_type.value,
                event.source,
                event.user,
                event.source_ip,
                event.description,
                event.severity,
                event.timestamp.isoformat(),
            ),
        )
        connection.commit()
        return {
            "status": "accepted",
            "event_id": cursor.lastrowid,
            "source_type": record.source_type,
            "source_name": record.source_name,
            "normalized_event": event.model_dump(mode="json"),
        }
    finally:
        connection.close()
