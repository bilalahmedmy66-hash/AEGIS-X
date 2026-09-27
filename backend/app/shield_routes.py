from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .shield import get_shield_status, verify_integrity, guard_response, assess_shield_response

shield_router = APIRouter(
    prefix="/api/v1/shield",
    tags=["AEGIS Shield"]
)


class ShieldGuardRequest(BaseModel):
    action: str
    risk_score: int = 0


class ShieldAssessmentRequest(BaseModel):
    action: str
    risk_score: int = 0
    incident_type: str = "UNKNOWN"


@shield_router.post("/assess")
def shield_assess(request: ShieldAssessmentRequest):
    return assess_shield_response(
        request.action,
        request.risk_score,
        request.incident_type,
    )

@shield_router.get("/status")
def shield_status():
    return get_shield_status()


@shield_router.get("/integrity")
def shield_integrity():
    return verify_integrity()


@shield_router.post("/guard")
def shield_guard(request: ShieldGuardRequest):
    result = guard_response(
        request.action,
        request.risk_score
    )

    if not result["allowed"]:
        raise HTTPException(
            status_code=403,
            detail=result
        )

    return result

