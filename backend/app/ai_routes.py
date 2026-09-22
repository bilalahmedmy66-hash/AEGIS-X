from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel

from .ai_core import analyze_security_context


ai_router = APIRouter(
    prefix="/api/v1/ai",
    tags=["AEGIS AI"],
)


class AIAnalysisRequest(BaseModel):
    incident_id: Optional[int] = None
    question: Optional[str] = None


@ai_router.get("/status")
def ai_status():
    import os

    return {
        "engine": "AEGIS AI CORE",
        "available": bool(os.getenv("GEMINI_API_KEY")),
        "model": os.getenv("AEGIS_GEMINI_MODEL", "gemini-3.8-flash"),
        "mode": "GEMINI_SECURITY_ANALYST",
        "autonomous_response": False,
        "simulation_only": True,
    }


@ai_router.post("/analyze")
def ai_analyze(request: AIAnalysisRequest):
    return analyze_security_context(
        incident_id=request.incident_id,
        question=request.question,
    )
