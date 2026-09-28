from enum import Enum
from pydantic import BaseModel, Field


class AnalystRole(str, Enum):
    VIEWER = "VIEWER"
    SOC_ANALYST = "SOC_ANALYST"
    INCIDENT_RESPONDER = "INCIDENT_RESPONDER"
    SECURITY_ADMIN = "SECURITY_ADMIN"


ROLE_PERMISSIONS = {
    AnalystRole.VIEWER: {
        "dashboard:view",
        "events:view",
        "alerts:view",
        "incidents:view",
    },
    AnalystRole.SOC_ANALYST: {
        "dashboard:view",
        "events:view",
        "alerts:view",
        "incidents:view",
        "investigation:view",
        "threat_hunting:run",
        "reports:view",
    },
    AnalystRole.INCIDENT_RESPONDER: {
        "dashboard:view",
        "events:view",
        "alerts:view",
        "incidents:view",
        "investigation:view",
        "threat_hunting:run",
        "reports:view",
        "response:simulate",
    },
    AnalystRole.SECURITY_ADMIN: {
        "dashboard:view",
        "events:view",
        "alerts:view",
        "incidents:view",
        "investigation:view",
        "threat_hunting:run",
        "reports:view",
        "response:simulate",
        "configuration:view",
        "policy:manage",
    },
}


class RoleProfile(BaseModel):
    role: AnalystRole
    description: str = Field(min_length=1)
    permissions: list[str]


ROLE_DESCRIPTIONS = {
    AnalystRole.VIEWER: "View security information without investigation or response actions.",
    AnalystRole.SOC_ANALYST: "Investigate incidents, run threat hunting, and review security reports.",
    AnalystRole.INCIDENT_RESPONDER: "Perform authorized response simulations in the academic environment.",
    AnalystRole.SECURITY_ADMIN: "Manage academic security configuration and policy permissions.",
}


def get_role_profile(role: AnalystRole) -> RoleProfile:
    return RoleProfile(
        role=role,
        description=ROLE_DESCRIPTIONS[role],
        permissions=sorted(ROLE_PERMISSIONS[role]),
    )


def has_permission(role: AnalystRole, permission: str) -> bool:
    return permission in ROLE_PERMISSIONS[role]
