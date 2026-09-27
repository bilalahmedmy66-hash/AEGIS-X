"""
AEGIS SHIELD
Continuous Security Protection & Integrity Layer

Academic implementation:
- file integrity verification
- protection-state evaluation
- response-policy guarding
- safe simulation only
"""

from __future__ import annotations

import hashlib
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any

BASE_DIR = Path(__file__).resolve().parents[2]

PROTECTED_FILES = [
    BASE_DIR / "backend" / "app" / "main.py",
    BASE_DIR / "backend" / "app" / "response.py",
    BASE_DIR / "backend" / "app" / "compatibility.py",
    BASE_DIR / "backend" / "app" / "detection.py",
    BASE_DIR / "frontend" / "index.html",
    BASE_DIR / "frontend" / "app.js",
]

PROTECTED_ACTIONS = {
    "MONITOR",
    "ALERT",
    "BLOCK_SOURCE",
    "ISOLATE_SOURCE",
}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def sha256_file(path: Path) -> str | None:
    try:
        digest = hashlib.sha256()
        with path.open("rb") as f:
            for chunk in iter(lambda: f.read(1024 * 1024), b""):
                digest.update(chunk)
        return digest.hexdigest()
    except (OSError, PermissionError):
        return None


def verify_integrity() -> Dict[str, Any]:
    results = []

    for path in PROTECTED_FILES:
        exists = path.exists()
        digest = sha256_file(path) if exists else None

        results.append(
            {
                "file": str(path.relative_to(BASE_DIR)).replace("\\", "/"),
                "exists": exists,
                "sha256": digest,
                "status": "VERIFIED" if digest else "MISSING_OR_UNREADABLE",
            }
        )

    verified = sum(1 for item in results if item["status"] == "VERIFIED")
    failed = len(results) - verified

    return {
        "timestamp": utc_now(),
        "status": "PROTECTED" if failed == 0 else "ELEVATED",
        "protected_files": len(results),
        "verified_files": verified,
        "failed_files": failed,
        "results": results,
    }


def get_shield_status() -> Dict[str, Any]:
    integrity = verify_integrity()

    return {
        "engine": "AEGIS SHIELD",
        "version": "1.0",
        "mode": "ACADEMIC_SAFE_MODE",
        "timestamp": utc_now(),
        "protection_state": integrity["status"],
        "components": {
            "system_integrity": "ACTIVE",
            "event_protection": "ACTIVE",
            "api_protection": "ACTIVE",
            "response_guard": "ACTIVE",
            "configuration_guard": "ACTIVE",
        },
        "response_policy": {
            "mode": "SIMULATION",
            "real_blocking": False,
            "real_isolation": False,
            "allowed_actions": sorted(PROTECTED_ACTIONS),
        },
        "integrity": integrity,
        "message": (
            "AEGIS SHIELD is protecting the software layer in "
            "academic safe mode."
        ),
    }



def assess_shield_response(
    action: str,
    risk_score: int,
    incident_type: str,
) -> Dict[str, Any]:
    """
    Explain and validate a proposed defensive response.

    Shield 2.0 remains simulation-only and requires
    explicit human approval before response execution.
    """

    normalized = str(action or "").upper()
    score = max(0, min(int(risk_score), 100))

    if score >= 75:
        risk_band = "CRITICAL"
    elif score >= 50:
        risk_band = "HIGH"
    elif score >= 25:
        risk_band = "MEDIUM"
    else:
        risk_band = "LOW"

    rationale_map = {
        "MONITOR": "Continue observation because the current risk does not justify an active response.",
        "ALERT": "Escalate analyst attention because the observed risk warrants additional review.",
        "BLOCK_SOURCE": "Simulate source blocking because the risk level indicates a stronger containment response.",
        "ISOLATE_SOURCE": "Simulate source isolation because the risk level indicates the strongest available containment response.",
    }

    guard = guard_response(normalized, score)

    return {
        "engine": "AEGIS SHIELD",
        "version": "2.0",
        "incident_type": str(incident_type or "UNKNOWN"),
        "risk_score": score,
        "risk_band": risk_band,
        "proposed_action": normalized,
        "allowed": guard["allowed"],
        "rationale": rationale_map.get(
            normalized,
            "No rationale is available for the proposed action.",
        ),
        "protection_state": verify_integrity()["status"],
        "requires_human_approval": True,
        "simulation_only": True,
        "real_execution": False,
        "mode": "SIMULATION",
    }

def guard_response(action: str, risk_score: int = 0) -> Dict[str, Any]:
    normalized = str(action or "").upper()

    if normalized not in PROTECTED_ACTIONS:
        return {
            "allowed": False,
            "action": normalized,
            "reason": "Action is not permitted by AEGIS SHIELD.",
            "mode": "SIMULATION",
        }

    if risk_score < 0:
        return {
            "allowed": False,
            "action": normalized,
            "reason": "Invalid risk score.",
            "mode": "SIMULATION",
        }

    return {
        "allowed": True,
        "action": normalized,
        "risk_score": risk_score,
        "mode": "SIMULATION",
        "real_execution": False,
        "reason": "Response approved by the AEGIS SHIELD policy guard.",
    }

