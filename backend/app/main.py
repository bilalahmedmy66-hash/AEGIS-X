from fastapi import FastAPI

from backend.app.events import SecurityEvent


app = FastAPI(
    title="AEGIS X",
    description="Universal Security Intelligence & Defense Platform",
    version="0.2.0",
)


# Temporary in-memory event store.
# A database will be introduced in a later milestone.
events: list[SecurityEvent] = []


@app.get("/")
def root():
    return {
        "name": "AEGIS X",
        "version": "0.2.0",
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
    events.append(event)

    return {
        "status": "accepted",
        "event_type": event.event_type,
        "total_events": len(events),
    }


@app.get("/api/v1/events")
def get_events():
    return {
        "total": len(events),
        "events": events,
    }