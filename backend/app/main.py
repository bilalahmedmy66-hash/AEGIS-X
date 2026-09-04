from contextlib import asynccontextmanager

from fastapi import FastAPI

from backend.app.database import get_connection, initialize_database
from backend.app.events import SecurityEvent


@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_database()
    yield


app = FastAPI(
    title="AEGIS X",
    description="Universal Security Intelligence & Defense Platform",
    version="0.3.0",
    lifespan=lifespan,
)


@app.get("/")
def root():
    return {
        "name": "AEGIS X",
        "version": "0.3.0",
        "status": "operational",
        "message": "AEGIS X security platform is running.",
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
    }


@app.post("/api/v1/events")
def ingest_event(event: SecurityEvent):
    connection = get_connection()

    cursor = connection.execute(
        """
        INSERT INTO security_events (
            event_type,
            source,
            user,
            source_ip,
            description,
            severity,
            timestamp
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
    event_id = cursor.lastrowid
    connection.close()

    return {
        "status": "accepted",
        "event_id": event_id,
        "event_type": event.event_type,
    }


@app.get("/api/v1/events")
def get_events():
    connection = get_connection()

    rows = connection.execute(
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
        ORDER BY id DESC
        """
    ).fetchall()

    connection.close()

    return {
        "total": len(rows),
        "events": [dict(row) for row in rows],
    }