from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.app.database import (
    get_connection,
    initialize_database,
)

from backend.app.detection import analyze_events
from backend.app.events import SecurityEvent
from backend.app.risk import calculate_risk

from backend.app.alerts import (
    create_alert,
    find_active_alert,
    get_alerts,
)

from backend.app.incidents import (
    create_incident,
    find_open_incident,
    get_incidents,
    update_incident_status,
)

from backend.app.response import (
    determine_response,
    execute_response,
    get_response_actions,
)

# PHASE 2.1
from backend.app.timeline import get_incident_timeline


# ============================================================
# PATH CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[2]

FRONTEND_DIR = BASE_DIR / "frontend"


# ============================================================
# APPLICATION LIFESPAN
# ============================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_database()
    yield


# ============================================================
# FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title="AEGIS X",
    description="Universal Security Intelligence & Defense Platform",
    version="0.5.0",
    lifespan=lifespan,
)


# ============================================================
# FRONTEND
# ============================================================

if FRONTEND_DIR.exists():
    app.mount(
        "/static",
        StaticFiles(directory=FRONTEND_DIR),
        name="static",
    )


@app.get("/dashboard", include_in_schema=False)
def dashboard():
    index_file = FRONTEND_DIR / "index.html"

    if not index_file.exists():
        raise HTTPException(
            status_code=404,
            detail="Dashboard frontend not found.",
        )

    return FileResponse(index_file)


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():
    return {
        "name": "AEGIS X",
        "version": "0.5.0",
        "status": "operational",
        "dashboard": "/dashboard",
        "docs": "/docs",
        "message": "AEGIS X security platform is running.",
    }


# ============================================================
# HEALTH
# ============================================================

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "AEGIS X",
    }


# ============================================================
# EVENTS
# ============================================================

@app.post("/api/v1/events")
def ingest_event(event: SecurityEvent):
    connection = get_connection()

    try:
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

    finally:
        connection.close()

    return {
        "status": "accepted",
        "event_id": event_id,
        "event_type": event.event_type,
    }


@app.get("/api/v1/events")
def get_events():
    connection = get_connection()

    try:
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

    finally:
        connection.close()

    events = [dict(row) for row in rows]

    return {
        "total": len(events),
        "events": events,
    }


# ============================================================
# DETECTION RESULTS
# ============================================================

@app.get("/api/v1/detections")
def get_detections():
    """
    Return stored detection results.

    READ-ONLY endpoint.

    This endpoint does not:
    - analyze events
    - create alerts
    - create incidents
    - execute responses

    This prevents dashboard polling from creating duplicates.
    """

    alerts = get_alerts()

    detections = []

    for alert in alerts:
        detections.append(
            {
                "id": alert["id"],
                "type": alert["alert_type"],
                "severity": alert["severity"],
                "source_ip": alert["source_ip"],
                "message": alert["message"],
                "status": alert["status"],
                "risk": {
                    "score": alert["risk_score"],
                    "level": alert["risk_level"],
                },
                "created_at": alert["created_at"],
            }
        )

    return {
        "total": len(detections),
        "alerts_generated": len(detections),
        "alerts": detections,
    }


# ============================================================
# DETECTION ANALYSIS PIPELINE
# ============================================================

@app.post("/api/v1/detections/analyze")
def analyze_detections():
    """
    Execute the AEGIS X detection pipeline.

    Pipeline:

        Security Events
              ↓
        Detection Engine
              ↓
        Risk Engine
              ↓
        Alert Management
              ↓
        Incident Management
              ↓
        Response Decision
    """

    # --------------------------------------------------------
    # LOAD EVENTS
    # --------------------------------------------------------

    connection = get_connection()

    try:
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

    finally:
        connection.close()

    events = [dict(row) for row in rows]

    # --------------------------------------------------------
    # DETECTION ENGINE
    # --------------------------------------------------------

    detection_result = analyze_events(events)

    # --------------------------------------------------------
    # SEVERITY MAPPING
    # --------------------------------------------------------

    severity_map = {
        "LOW": 1,
        "MEDIUM": 3,
        "HIGH": 5,
        "CRITICAL": 10,
    }

    # --------------------------------------------------------
    # RESULT COLLECTION
    # --------------------------------------------------------

    created_alerts = []
    existing_alerts = []

    created_incidents = []
    existing_incidents = []

    # --------------------------------------------------------
    # PROCESS DETECTIONS
    # --------------------------------------------------------

    for alert in detection_result["alerts"]:

        severity_name = alert.get(
            "severity",
            "LOW",
        )

        severity_value = severity_map.get(
            severity_name,
            1,
        )

        source_ip = alert.get("source_ip")

        # Count events associated with source
        event_count = sum(
            1
            for event in events
            if event.get("source_ip") == source_ip
        )

        # ----------------------------------------------------
        # RISK ENGINE
        # ----------------------------------------------------

        risk = calculate_risk(
            severity=severity_value,
            alert_type=alert.get("type"),
            event_count=event_count,
        )

        alert["risk"] = risk

        alert_type = alert.get(
            "type",
            "UNKNOWN",
        )

        message = alert.get(
            "message",
            "",
        )

        # ----------------------------------------------------
        # RESPONSE DECISION
        # ----------------------------------------------------

        response = determine_response(
            risk_score=risk["score"],
            risk_level=risk["level"],
            incident_type=alert_type,
        )

        alert["response"] = response

        # ====================================================
        # ALERT MANAGEMENT
        # ====================================================

        existing_alert = find_active_alert(
            alert_type=alert_type,
            source_ip=source_ip,
        )

        if existing_alert:

            existing_alerts.append(
                {
                    "alert_id": existing_alert["id"],
                    "type": existing_alert["alert_type"],
                    "status": existing_alert["status"],
                    "risk": {
                        "score": existing_alert["risk_score"],
                        "level": existing_alert["risk_level"],
                    },
                }
            )

        else:

            alert_id = create_alert(alert)

            created_alerts.append(
                {
                    "alert_id": alert_id,
                    "type": alert_type,
                    "severity": severity_name,
                    "risk": risk,
                }
            )

        # ====================================================
        # INCIDENT MANAGEMENT
        # ====================================================

        existing_incident = find_open_incident(
            incident_type=alert_type,
            source_ip=source_ip,
        )

        if existing_incident:

            existing_incidents.append(
                {
                    "incident_id": existing_incident["id"],
                    "type": existing_incident["incident_type"],
                    "status": existing_incident["status"],
                    "risk": {
                        "score": existing_incident["risk_score"],
                        "level": existing_incident["risk_level"],
                    },
                }
            )

        else:

            incident_id = create_incident(
                incident_type=alert_type,
                severity=severity_name,
                risk_score=risk["score"],
                risk_level=risk["level"],
                source_ip=source_ip,
                description=message,
            )

            created_incidents.append(
                {
                    "incident_id": incident_id,
                    "type": alert_type,
                    "severity": severity_name,
                    "risk": risk,
                }
            )

    # --------------------------------------------------------
    # RETURN RESULT
    # --------------------------------------------------------

    return {
        "total_events_analyzed": detection_result[
            "total_events_analyzed"
        ],
        "alerts_generated": detection_result[
            "alerts_generated"
        ],
        "alerts": detection_result["alerts"],
        "database_alerts_created": created_alerts,
        "existing_active_alerts": existing_alerts,
        "database_incidents_created": created_incidents,
        "existing_open_incidents": existing_incidents,
    }


# ============================================================
# ALERT API
# ============================================================

@app.get("/api/v1/alerts")
def list_alerts():
    alerts = get_alerts()

    return {
        "total": len(alerts),
        "alerts": alerts,
    }


# ============================================================
# INCIDENT API
# ============================================================

@app.get("/api/v1/incidents")
def list_incidents():
    incidents = get_incidents()

    return {
        "total": len(incidents),
        "incidents": incidents,
    }


# ============================================================
# PHASE 2.1 — INCIDENT TIMELINE
# ============================================================

@app.get("/api/v1/incidents/{incident_id}/timeline")
def incident_timeline(incident_id: int):
    """
    Return the complete investigation timeline
    for a security incident.

    Correlation:

        EVENT
          ↓
        ALERT
          ↓
        INCIDENT
          ↓
        RESPONSE
          ↓
        STATUS
    """

    result = get_incident_timeline(
        incident_id=incident_id,
    )

    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Incident not found.",
        )

    return result


# ============================================================
# INCIDENT STATUS
# ============================================================

@app.patch("/api/v1/incidents/{incident_id}/status")
def change_incident_status(
    incident_id: int,
    status: str,
):
    updated = update_incident_status(
        incident_id=incident_id,
        status=status,
    )

    if not updated:
        raise HTTPException(
            status_code=404,
            detail="Incident not found.",
        )

    return {
        "updated": True,
        "incident_id": incident_id,
        "status": status,
    }


# ============================================================
# INCIDENT RESPONSE
# ============================================================

@app.post("/api/v1/incidents/{incident_id}/respond")
def run_incident_response(
    incident_id: int,
):
    connection = get_connection()

    try:
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
            WHERE id = ?
            """,
            (incident_id,),
        ).fetchone()

    finally:
        connection.close()

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="Incident not found.",
        )

    incident = dict(row)

    # --------------------------------------------------------
    # DETERMINE RESPONSE
    # --------------------------------------------------------

    response = determine_response(
        risk_score=incident["risk_score"],
        risk_level=incident["risk_level"],
        incident_type=incident["incident_type"],
    )

    # --------------------------------------------------------
    # EXECUTE RESPONSE
    #
    # Current implementation is simulation-only.
    # --------------------------------------------------------

    execution = execute_response(
        incident_id=incident["id"],
        action=response["action"],
        source_ip=incident["source_ip"],
        mode=response["mode"],
    )

    return {
        "incident": incident,
        "response": response,
        "execution": execution,
    }


# ============================================================
# RESPONSE ACTIONS
# ============================================================

@app.get("/api/v1/responses")
def list_response_actions():
    responses = get_response_actions()

    return {
        "total": len(responses),
        "responses": responses,
    }