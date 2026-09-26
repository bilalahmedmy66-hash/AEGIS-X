from fastapi import APIRouter
from .soc import soc_state

soc_router = APIRouter(
    prefix="/api/v1/soc",
    tags=["AEGIS Real-Time SOC"],
)


@soc_router.get("/state")
def get_soc_state():
    return soc_state()
