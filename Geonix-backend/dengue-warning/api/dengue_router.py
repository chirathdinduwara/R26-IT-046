from __future__ import annotations

from fastapi import APIRouter, Query

from .dengue_schemas import AreaSummaryResponse, MapAreaResponse, PreventionGuideResponse
from .dengue_service import get_area_summary, get_map_areas, get_prevention_guide


router = APIRouter(prefix="/dengue", tags=["dengue"])


@router.get("/map", response_model=list[MapAreaResponse])
def dengue_map() -> list[MapAreaResponse]:
    return get_map_areas()


@router.get("/summary", response_model=AreaSummaryResponse)
def dengue_summary(
    lat: float = Query(..., ge=5.0, le=10.5, description="User latitude in Sri Lanka bounds."),
    lng: float = Query(..., ge=79.0, le=82.0, description="User longitude in Sri Lanka bounds."),
) -> AreaSummaryResponse:
    return get_area_summary(latitude=lat, longitude=lng)


@router.get("/prevention", response_model=PreventionGuideResponse)
def dengue_prevention() -> PreventionGuideResponse:
    return get_prevention_guide()
