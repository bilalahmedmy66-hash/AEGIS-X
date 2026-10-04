from fastapi import APIRouter
from .security_brain import build_security_brain

brain_router = APIRouter(
    prefix="/api/v1",
    tags=["AEGIS Security Brain"],
)

@brain_router.get("/incidents/{incident_id}/brain")
def incident_brain(incident_id: int):
    return build_security_brain(incident_id)
