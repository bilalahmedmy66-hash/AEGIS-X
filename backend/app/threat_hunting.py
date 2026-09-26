from fastapi import APIRouter, Query
from backend.app.database import get_connection

threat_hunting_router = APIRouter(
    prefix="/api/v1/threat-hunting",
    tags=["Threat Hunting"],
)


@threat_hunting_router.get("/search")
def search_events(
    event_type: str | None = None,
    source: str | None = None,
    user: str | None = None,
    source_ip: str | None = None,
    min_severity: int | None = Query(default=None, ge=1, le=10),
    q: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
):
    connection = get_connection()

    try:
        conditions = []
        params = []

        if event_type:
            conditions.append("event_type = ?")
            params.append(event_type)

        if source:
            conditions.append("source = ?")
            params.append(source)

        if user:
            conditions.append("user = ?")
            params.append(user)

        if source_ip:
            conditions.append("source_ip = ?")
            params.append(source_ip)

        if min_severity is not None:
            conditions.append("severity >= ?")
            params.append(min_severity)

        if q:
            conditions.append(
                "(description LIKE ? OR event_type LIKE ? OR source LIKE ?)"
            )
            search_value = f"%{q}%"
            params.extend([search_value, search_value, search_value])

        where_clause = ""
        if conditions:
            where_clause = "WHERE " + " AND ".join(conditions)

        rows = connection.execute(
            f"""
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
            {where_clause}
            ORDER BY id DESC
            LIMIT ?
            """,
            (*params, limit),
        ).fetchall()

        events = [dict(row) for row in rows]

        return {
            "total": len(events),
            "filters": {
                "event_type": event_type,
                "source": source,
                "user": user,
                "source_ip": source_ip,
                "min_severity": min_severity,
                "q": q,
                "limit": limit,
            },
            "events": events,
            "read_only": True,
        }

    finally:
        connection.close()
