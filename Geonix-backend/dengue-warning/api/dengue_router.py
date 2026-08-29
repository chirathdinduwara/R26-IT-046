from __future__ import annotations

import os
import shutil
import requests

from pathlib import Path

from fastapi import (
    APIRouter,
    File,
    HTTPException,
    Query,
    UploadFile,
)

from .dengue_schemas import (
    AreaSummaryResponse,
    MapAreaResponse,
    PreventionGuideResponse,
    ChatRequest,
    ChatResponse,
    RiskResponse,
    HistoryResponse,
    ForecastResponse,
    HotspotItem,
    HotspotsResponse,
    AIExplanationResponse,
)

from .dengue_service import (
    get_area_summary,
    get_map_areas,
    get_prevention_guide,
    predict_area_dengue_risk,
    _build_area_history_complete,
    DIVISION_HISTORICAL_CASES,
    AREAS,
)

from .model_manager import (
    FEATURES_PATH,
    MODEL_PATH,
    SCALER_PATH,
    model_manager,
)


router = APIRouter(
    prefix="/dengue",
    tags=["dengue"],
)


# ============================================================
# Map
# ============================================================

@router.get(
    "/map",
    response_model=list[MapAreaResponse],
)
def dengue_map(
    lat: float | None = Query(
        None,
        ge=5.0,
        le=10.5,
        description=(
            "Optional weather anchor latitude "
            "in Sri Lanka bounds."
        ),
    ),

    lng: float | None = Query(
        None,
        ge=79.0,
        le=82.0,
        description=(
            "Optional weather anchor longitude "
            "in Sri Lanka bounds."
        ),
    ),

    refresh: bool = Query(
        False,
        description=(
            "Force fresh weather fetch and "
            "bypass weather cache."
        ),
    ),
) -> list[MapAreaResponse]:

    try:

        return get_map_areas(
            latitude=lat,
            longitude=lng,
            force_refresh=refresh,
        )

    except RuntimeError as exc:

        # If a forced refresh fails, try cached data.
        if refresh:

            try:

                return get_map_areas(
                    latitude=lat,
                    longitude=lng,
                    force_refresh=False,
                )

            except RuntimeError as cached_exc:

                raise HTTPException(
                    status_code=503,
                    detail=str(cached_exc),
                ) from cached_exc

        raise HTTPException(
            status_code=503,
            detail=str(exc),
        ) from exc


# ============================================================
# Summary
# ============================================================

@router.get(
    "/summary",
    response_model=AreaSummaryResponse,
)
def dengue_summary(
    lat: float = Query(
        ...,
        ge=5.0,
        le=10.5,
        description=(
            "User latitude in Sri Lanka bounds."
        ),
    ),

    lng: float = Query(
        ...,
        ge=79.0,
        le=82.0,
        description=(
            "User longitude in Sri Lanka bounds."
        ),
    ),

    refresh: bool = Query(
        False,
        description=(
            "Force fresh weather fetch and "
            "bypass weather cache."
        ),
    ),
) -> AreaSummaryResponse:

    try:

        return get_area_summary(
            latitude=lat,
            longitude=lng,
            force_refresh=refresh,
        )

    except RuntimeError as exc:

        if refresh:

            try:

                return get_area_summary(
                    latitude=lat,
                    longitude=lng,
                    force_refresh=False,
                )

            except RuntimeError as cached_exc:

                raise HTTPException(
                    status_code=503,
                    detail=str(cached_exc),
                ) from cached_exc

        raise HTTPException(
            status_code=503,
            detail=str(exc),
        ) from exc


# ============================================================
# Prevention
# ============================================================

@router.get(
    "/prevention",
    response_model=PreventionGuideResponse,
)
def dengue_prevention() -> PreventionGuideResponse:

    return get_prevention_guide()


# ============================================================
# Chat
# ============================================================

@router.post(
    "/chat",
    response_model=ChatResponse,
)
def dengue_chat(
    payload: ChatRequest,
) -> ChatResponse:

    """
    Tailored dengue chatbot helper.

    Uses Gemini if configured.
    Falls back to rule-based responses if Gemini
    is unavailable.
    """

    prevention = get_prevention_guide()

    guide_context = (
        "Dengue Prevention Guidelines:\n"
        f"- What to do now: "
        f"{', '.join(prevention['do_now'])}\n"
        f"- How to prevent breeding: "
        f"{', '.join(prevention['prevent'])}\n"
        f"- How to reduce community spread: "
        f"{', '.join(prevention['reduce'])}\n"
    )

    # ----------------------------------------------------------
    # Load environment
    # ----------------------------------------------------------

    from dotenv import load_dotenv

    # override=False (default) so that real environment variables
    # injected by the platform (e.g. Railway's Variables tab) always
    # take precedence over anything found in a local .env file.
    load_dotenv(
        Path(__file__).resolve().parent.parent
        / ".env",
        override=False,
    )

    api_key = os.getenv(
        "GEMINI_API_KEY",
        "",
    ).strip()

    model = os.getenv(
        "GEMINI_MODEL",
        "gemini-3.6-flash",
    )

    # ----------------------------------------------------------
    # Gemini
    # ----------------------------------------------------------

    if api_key:

        contents = []

        for msg in payload.history:

            role = (
                "user"
                if msg.get("role") == "user"
                else "model"
            )

            contents.append(
                {
                    "role": role,

                    "parts": [
                        {
                            "text": msg.get(
                                "text",
                                "",
                            )
                        }
                    ],
                }
            )

        contents.append(
            {
                "role": "user",

                "parts": [
                    {
                        "text": payload.message
                    }
                ],
            }
        )

        system_instruction = {
            "parts": [
                {
                    "text": (
                        "You are the Geonix Dengue AI Safety Assistant. "
                        "You provide helpful, friendly, and practical "
                        "medical/prevention advice to Sri Lankan users "
                        "regarding Dengue fever.\n\n"

                        "CRITICAL RULES:\n"

                        "1. You MUST ONLY answer queries related to "
                        "Dengue fever, breeding prevention, symptoms, "
                        "treatment guidelines, or risk control. "
                        "If the user asks about ANY other topic, "
                        "politely decline to answer and explain that "
                        "your sole purpose is assisting with Dengue safety.\n"

                        "2. Detect the language of the user's question "
                        "(Sinhala, Tamil, or English) and reply in the "
                        "same language. If Sinhala or Singlish, reply "
                        "in Sinhala. If Tamil, reply in Tamil. "
                        "If English, reply in English.\n"

                        "3. Keep answers concise, helpful, and under "
                        "3 sentences or use short bullet points.\n"

                        "4. Do not provide direct medical prescriptions. "
                        "Advise seeing a healthcare professional for "
                        "severe symptoms.\n"

                        "5. Use the following context guidelines "
                        "when relevant:\n"

                        f"{guide_context}"
                    )
                }
            ]
        }

        url = (
            "https://generativelanguage.googleapis.com/"
            f"v1beta/models/{model}:generateContent"
            f"?key={api_key}"
        )

        try:

            req_payload = {
                "contents": contents,

                "systemInstruction": system_instruction,

                "generationConfig": {
                    "temperature": 0.2,
                },
            }

            response = requests.post(
                url,
                json=req_payload,
                timeout=25,
            )

            response.raise_for_status()

            res_data = response.json()

            reply = (
                res_data[
                    "candidates"
                ][0][
                    "content"
                ][
                    "parts"
                ][0][
                    "text"
                ]
            )

            return ChatResponse(
                response=reply.strip()
            )

        except Exception as err:

            print(
                "Gemini Chat Error:",
                err,
            )

    # ----------------------------------------------------------
    # Rule-based fallback
    # ----------------------------------------------------------

    msg_lower = (
        payload.message.lower()
    )

    if (
        "prevent" in msg_lower
        or "breeding" in msg_lower
        or "stagnant" in msg_lower
    ):

        reply = (
            "To prevent breeding: "
            f"{prevention['prevent'][0]} "
            "and "
            f"{prevention['prevent'][1].lower()}"
        )

    elif (
        "symptom" in msg_lower
        or "fever" in msg_lower
        or "sick" in msg_lower
    ):

        reply = (
            "If fever or body pain appears, please "
            f"{prevention['reduce'][0].lower()} "
            "and "
            f"{prevention['do_now'][2].lower()}"
        )

    else:

        reply = (
            "I recommend taking immediate prevention action: "
            f"{prevention['do_now'][0]} "
            "Also, "
            f"{prevention['do_now'][1].lower()}"
        )

    return ChatResponse(
        response=reply
    )


# ============================================================
# Model status
# ============================================================

@router.get(
    "/admin/model-status"
)
def get_model_status():

    return model_manager.get_status()


# ============================================================
# Upload model
# ============================================================

@router.post(
    "/admin/upload-model"
)
async def upload_model(
    model_file: UploadFile | None = File(None),
    features_file: UploadFile | None = File(None),
    scaler_file: UploadFile | None = File(None),
):

    """
    Allows hot-swapping model artifacts via
    multipart file uploads.
    """

    saved = []

    # ----------------------------------------------------------
    # Model
    # ----------------------------------------------------------

    if model_file is not None:

        MODEL_PATH.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        with MODEL_PATH.open(
            "wb"
        ) as buffer:

            shutil.copyfileobj(
                model_file.file,
                buffer,
            )

        saved.append(
            "model"
        )

    # ----------------------------------------------------------
    # Features
    # ----------------------------------------------------------

    if features_file is not None:

        FEATURES_PATH.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        with FEATURES_PATH.open(
            "wb"
        ) as buffer:

            shutil.copyfileobj(
                features_file.file,
                buffer,
            )

        saved.append(
            "features"
        )

    # ----------------------------------------------------------
    # Scaler
    # ----------------------------------------------------------

    if scaler_file is not None:

        SCALER_PATH.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        with SCALER_PATH.open(
            "wb"
        ) as buffer:

            shutil.copyfileobj(
                scaler_file.file,
                buffer,
            )

        saved.append(
            "scaler"
        )

    # ----------------------------------------------------------
    # Reload model
    # ----------------------------------------------------------

    model_manager.load_or_reload()

    return {
        "status": "success",

        "message": (
            "Successfully uploaded and hot-swapped: "
            + ", ".join(saved)
            if saved
            else "No files uploaded."
        ),
    }


# ============================================================
# New REST endpoints for Dengue warnings and predictions
# ============================================================

@router.get(
    "/risk/{area}",
    response_model=RiskResponse,
)
def get_area_risk(
    area: str,
) -> RiskResponse:
    target_area = None
    area_lower = area.lower().replace("-", "_").strip()
    for a in AREAS:
        a_name_lower = a.area_name.lower().replace(" ", "_").strip()
        if a.area_id == area_lower or a_name_lower == area_lower or a.area_id.replace("_", "") == area_lower.replace("_", ""):
            target_area = a
            break
            
    if not target_area:
        raise HTTPException(status_code=404, detail=f"Area '{area}' not found.")
        
    try:
        from .weather_service import get_realtime_weather
        weather = get_realtime_weather(target_area.center[0], target_area.center[1])
    except Exception:
        weather = {}
        
    try:
        pred_res = predict_area_dengue_risk(target_area.area_id, weather)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Inference failed: {exc}")
        
    return RiskResponse(
        area_id=target_area.area_id,
        area_name=target_area.area_name,
        risk_level=pred_res["current_week"]["risk_level"],
        risk_score=pred_res["current_week"]["risk_score"],
        probabilities=pred_res["current_week"]["probabilities"],
    )


@router.get(
    "/risk-map",
    response_model=list[MapAreaResponse],
)
def get_risk_map() -> list[MapAreaResponse]:
    return get_map_areas()


@router.get(
    "/history/{area}",
    response_model=HistoryResponse,
)
def get_area_history(
    area: str,
) -> HistoryResponse:
    target_area = None
    area_lower = area.lower().replace("-", "_").strip()
    for a in AREAS:
        a_name_lower = a.area_name.lower().replace(" ", "_").strip()
        if a.area_id == area_lower or a_name_lower == area_lower or a.area_id.replace("_", "") == area_lower.replace("_", ""):
            target_area = a
            break
            
    if not target_area:
        raise HTTPException(status_code=404, detail=f"Area '{area}' not found.")
        
    try:
        from .weather_service import get_realtime_weather
        weather = get_realtime_weather(target_area.center[0], target_area.center[1])
        history_points = _build_area_history_complete(target_area.area_id, weather)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load history: {exc}")
        
    return HistoryResponse(
        area_id=target_area.area_id,
        area_name=target_area.area_name,
        history=history_points[:6],
    )


@router.get(
    "/forecast/{area}",
    response_model=ForecastResponse,
)
def get_area_forecast(
    area: str,
) -> ForecastResponse:
    target_area = None
    area_lower = area.lower().replace("-", "_").strip()
    for a in AREAS:
        a_name_lower = a.area_name.lower().replace(" ", "_").strip()
        if a.area_id == area_lower or a_name_lower == area_lower or a.area_id.replace("_", "") == area_lower.replace("_", ""):
            target_area = a
            break
            
    if not target_area:
        raise HTTPException(status_code=404, detail=f"Area '{area}' not found.")
        
    try:
        from .weather_service import get_realtime_weather
        weather = get_realtime_weather(target_area.center[0], target_area.center[1])
    except Exception:
        weather = {}
        
    try:
        pred_res = predict_area_dengue_risk(target_area.area_id, weather)
        history_points = _build_area_history_complete(target_area.area_id, weather)
        next_week_point = history_points[7]
        week_after_next_point = history_points[8]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Forecast failed: {exc}")
        
    return ForecastResponse(
        area_id=target_area.area_id,
        area_name=target_area.area_name,
        next_week=next_week_point,
        week_after_next=week_after_next_point,
        trend=pred_res["trend"],
        risk_escalation=pred_res["escalation"]["risk_escalation"],
    )


@router.get(
    "/hotspots",
    response_model=HotspotsResponse,
)
def get_hotspots() -> HotspotsResponse:
    hotspots_list = []
    try:
        from .weather_service import get_realtime_weather
        weather = get_realtime_weather(6.9271, 79.8612)
    except Exception:
        weather = {}
        
    for a in AREAS:
        try:
            pred_res = predict_area_dengue_risk(a.area_id, weather)
            high_prob = pred_res["current_week"]["probabilities"].get("High", 0.0)
            hotspots_list.append(HotspotItem(
                area_id=a.area_id,
                area_name=a.area_name,
                risk_level=pred_res["current_week"]["risk_level"],
                high_probability=high_prob,
            ))
        except Exception:
            continue
            
    hotspots_list.sort(key=lambda x: x.high_probability, reverse=True)
    return HotspotsResponse(hotspots=hotspots_list)


@router.get(
    "/ai-explanation/{area}",
    response_model=AIExplanationResponse,
)
def get_ai_explanation(
    area: str,
) -> AIExplanationResponse:
    target_area = None
    area_lower = area.lower().replace("-", "_").strip()
    for a in AREAS:
        a_name_lower = a.area_name.lower().replace(" ", "_").strip()
        if a.area_id == area_lower or a_name_lower == area_lower or a.area_id.replace("_", "") == area_lower.replace("_", ""):
            target_area = a
            break
            
    if not target_area:
        raise HTTPException(status_code=404, detail=f"Area '{area}' not found.")
        
    try:
        from .weather_service import get_realtime_weather
        weather = get_realtime_weather(target_area.center[0], target_area.center[1])
    except Exception:
        weather = {}
        
    try:
        pred_res = predict_area_dengue_risk(target_area.area_id, weather)
        history_cases = DIVISION_HISTORICAL_CASES.get(target_area.area_id, DIVISION_HISTORICAL_CASES["colombo"])
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Inference failed: {exc}")
        
    from .gemini_client import GeminiConfig, GeminiExplainer
    from dotenv import load_dotenv
    import os
    # override=False so Railway's injected variables win over any
    # local .env file that might exist in the deployment.
    load_dotenv(Path(__file__).resolve().parent.parent / ".env", override=False)
    
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    model = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")
    
    if not api_key:
        explanation = (
            f"The ML model predicts a '{pred_res['current_week']['risk_level']}' dengue risk level for {target_area.area_name}. "
            f"This is driven by a current temperature of {weather.get('temperature_c', 28.0):.1f}°C and today's rain of {weather.get('today_rain_mm', 0.0):.1f}mm. "
            f"The 6-week historical case trajectory trends from {history_cases[0]} to {history_cases[-1]} cases weekly, "
            f"suggesting a '{pred_res['trend']}' trend for future vector activities."
        )
    else:
        try:
            config = GeminiConfig(api_key=api_key, model=model)
            explainer = GeminiExplainer(config)
            explanation = explainer.generate_explanation(
                area_name=target_area.area_name,
                current_level=pred_res["current_week"]["risk_level"].capitalize(),
                current_score=pred_res["current_week"]["risk_score"],
                next_week_level=pred_res["next_week"]["risk_level"].capitalize(),
                week_after_next_level=pred_res["week_after_next"]["risk_level"].capitalize(),
                probabilities=pred_res["current_week"]["probabilities"],
                history_trajectory=history_cases,
                weather=weather,
                trend=pred_res["trend"],
                escalation=pred_res["escalation"]
            )
        except Exception as exc:
            explanation = (
                f"The ML model predicts a '{pred_res['current_week']['risk_level']}' dengue risk level for {target_area.area_name}. "
                f"This is driven by a current temperature of {weather.get('temperature_c', 28.0):.1f}°C and today's rain of {weather.get('today_rain_mm', 0.0):.1f}mm. "
                f"The 6-week historical case trajectory trends from {history_cases[0]} to {history_cases[-1]} cases weekly, "
                f"suggesting a '{pred_res['trend']}' trend for future vector activities."
            )
            
    return AIExplanationResponse(
        area_id=target_area.area_id,
        area_name=target_area.area_name,
        current_risk_level=pred_res["current_week"]["risk_level"],
        explanation=explanation
    )