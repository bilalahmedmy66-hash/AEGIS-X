from datetime import datetime, timezone

from fastapi import HTTPException
from pydantic import BaseModel

from backend.app.database import get_connection
from backend.app.main import analyze_detections
from backend.app.events import SecurityEvent


class SimulationRequest(BaseModel):
    scenario: str = "BRUTE_FORCE"
    source_ip: str = "203.0.113.200"
    user: str = "admin"
    source: str = "simulator-security-agent"
    events: int = 5
    severity: int = 7


SUPPORTED_SCENARIOS = {
    "BRUTE_FORCE",
    "SUSPICIOUS_LOGIN",
    "PRIVILEGE_ESCALATION",
    "MALWARE_DETECTED",
    "FILE_MODIFIED",
    "UNUSUAL_ACCESS",
}


SCENARIO_EVENT_TYPES = {
    "BRUTE_FORCE": "LOGIN_FAILED",
    "SUSPICIOUS_LOGIN": "SUSPICIOUS_IP",
    "PRIVILEGE_ESCALATION": "PRIVILEGE_CHANGE",
    "MALWARE_DETECTED": "MALWARE_DETECTED",
    "FILE_MODIFIED": "FILE_MODIFIED",
    "UNUSUAL_ACCESS": "UNUSUAL_ACCESS",
}


def run_simulation(request: SimulationRequest):
    scenario = request.scenario.upper()

    if scenario not in SUPPORTED_SCENARIOS:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Unsupported simulation scenario.",
                "supported_scenarios": sorted(SUPPORTED_SCENARIOS),
            },
        )

    if request.events < 1:
        raise HTTPException(
            status_code=400,
            detail="Simulation must generate at least 1 event.",
        )

    if request.events > 20:
        raise HTTPException(
            status_code=400,
            detail="Maximum simulation size is 20 events.",
        )

    event_type = SCENARIO_EVENT_TYPES[scenario]

    generated_events = []

    connection = get_connection()

    try:
        for index in range(1, request.events + 1):
            event = SecurityEvent(
                event_type=event_type,
                source=request.source,
                user=request.user,
                source_ip=request.source_ip,
                description=(
                    f"SIMULATED {scenario} event "
                    f"{index}/{request.events}"
                ),
                severity=request.severity,
                timestamp=datetime.now(timezone.utc),
            )

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

            generated_events.append(
                {
                    "event_id": cursor.lastrowid,
                    "event_type": event.event_type.value,
                    "source": event.source,
                    "user": event.user,
                    "source_ip": event.source_ip,
                }
            )

        connection.commit()

    finally:
        connection.close()

    # Execute the existing detection pipeline once.
    detection_result = analyze_detections()

    return {
        "status": "simulation_completed",
        "simulation": {
            "scenario": scenario,
            "mode": "SYNTHETIC_TELEMETRY",
            "source_ip": request.source_ip,
            "user": request.user,
            "events_generated": request.events,
            "event_type": event_type,
        },
        "events": generated_events,
        "detection_runs": 1,
        "final_detection": detection_result,
    }


# Backward-compatible wrapper for the existing brute-force endpoint.
class BruteForceSimulationRequest(BaseModel):
    source_ip: str = "203.0.113.99"
    user: str = "admin"
    source: str = "simulator-auth-server"
    attempts: int = 5
    severity: int = 7


def run_brute_force_simulation(request: BruteForceSimulationRequest):
    return run_simulation(
        SimulationRequest(
            scenario="BRUTE_FORCE",
            source_ip=request.source_ip,
            user=request.user,
            source=request.source,
            events=request.attempts,
            severity=request.severity,
        )
    )
