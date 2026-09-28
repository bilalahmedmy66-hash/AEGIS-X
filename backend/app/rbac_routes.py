from fastapi import APIRouter
from backend.app.rbac import AnalystRole, get_role_profile, has_permission

rbac_router = APIRouter(
    prefix="/api/v1/rbac",
    tags=["RBAC / Analyst Roles"],
)


@rbac_router.get("/roles")
def list_roles():
    return {
        "status": "prototype",
        "authentication": "prototype-level",
        "roles": [
            get_role_profile(role).model_dump(mode="json")
            for role in AnalystRole
        ],
    }


@rbac_router.get("/roles/{role}/permissions")
def role_permissions(role: AnalystRole):
    profile = get_role_profile(role)
    return profile.model_dump(mode="json")


@rbac_router.get("/check")
def check_permission(role: AnalystRole, permission: str):
    return {
        "role": role.value,
        "permission": permission,
        "allowed": has_permission(role, permission),
    }
