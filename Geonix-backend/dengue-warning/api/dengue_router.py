from __future__ import annotations

import os
import shutil
import requests
from pathlib import Path
from fastapi import APIRouter, File, Query, UploadFile

from .dengue_schemas import (
    AreaSummaryResponse,
    MapAreaResponse,
    PreventionGuideResponse,
    ChatRequest,
    ChatResponse,
)
from .dengue_service import get_area_summary, get_map_areas, get_prevention_guide
from .model_manager import FEATURES_PATH, MODEL_PATH, SCALER_PATH, model_manager

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

@router.post("/chat", response_model=ChatResponse)
def dengue_chat(payload: ChatRequest) -> ChatResponse:
    """
    Tailored chatbot helper for dengue advice. Calls Gemini if configured,
    otherwise falls back to rule-based contextual answers.
    """
    prevention = get_prevention_guide()
    guide_context = (
        "Dengue Prevention Guidelines:\n"
        f"- What to do now: {', '.join(prevention['do_now'])}\n"
        f"- How to prevent breeding: {', '.join(prevention['prevent'])}\n"
        f"- How to reduce community spread: {', '.join(prevention['reduce'])}\n"
    )

    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env", override=True)

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

    if api_key:
        contents = []
        for msg in payload.history:
            role = "user" if msg.get("role") == "user" else "model"
            contents.append({
                "role": role,
                "parts": [{"text": msg.get("text", "")}]
            })
        
        contents.append({
            "role": "user",
            "parts": [{"text": payload.message}]
        })

        system_instruction = {
            "parts": [{
                "text": (
                    "You are the Geonix Dengue AI Safety Assistant. "
                    "You provide helpful, friendly, and practical medical/prevention advice to Sri Lankan users regarding Dengue fever.\n\n"
                    "CRITICAL RULES:\n"
                    "1. You MUST ONLY answer queries related to Dengue fever, breeding prevention, symptoms, treatment guidelines, or risk control. "
                    "If the user asks about ANY other topic (e.g. general knowledge, programming, non-dengue medicine, translation of other things, jokes, general talk, etc.), you must politely decline to answer, explaining that your sole purpose is assisting with Dengue safety.\n"
                    "2. Detect the language of the user's question (Sinhala, Tamil, or English) and reply in that same language. "
                    "If they write in Sinhala (or Singlish), reply in Sinhala. If in Tamil, reply in Tamil. If in English, reply in English.\n"
                    "3. Keep answers concise, helpful, and under 3 sentences (or use short bullet points).\n"
                    "4. Do not provide direct medical prescriptions. Advise seeing a healthcare professional for severe symptoms.\n"
                    "5. Use the following context guidelines to assist when relevant:\n"
                    f"{guide_context}"
                )
            }]
        }

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        try:
            req_payload = {
                "contents": contents,
                "systemInstruction": system_instruction,
                "generationConfig": {
                    "temperature": 0.2
                }
            }
            r = requests.post(url, json=req_payload, timeout=25)
            r.raise_for_status()
            res_data = r.json()
            reply = res_data["candidates"][0]["content"]["parts"][0]["text"]
            return ChatResponse(response=reply.strip())
        except Exception as err:
            print("Gemini Chat Error:", err)
            pass

    # Rule-based fallback if Gemini is offline or API key is not set
    msg_lower = payload.message.lower()
    if "prevent" in msg_lower or "breeding" in msg_lower or "stagnant" in msg_lower:
        reply = f"To prevent breeding: {prevention['prevent'][0]} and {prevention['prevent'][1].lower()}"
    elif "symptom" in msg_lower or "fever" in msg_lower or "sick" in msg_lower:
        reply = f"If fever or body pain appears, please {prevention['reduce'][0].lower()} and {prevention['do_now'][2].lower()}"
    else:
        reply = f"I recommend taking immediate prevention action: {prevention['do_now'][0]} Also, {prevention['do_now'][1].lower()}"

    return ChatResponse(response=reply)

@router.get("/admin/model-status")
def get_model_status():
    """Returns currently loaded model, features, and scaler metadata."""
    return model_manager.get_status()

@router.post("/admin/upload-model")
async def upload_model(
    model_file: UploadFile | None = File(None),
    features_file: UploadFile | None = File(None),
    scaler_file: UploadFile | None = File(None),
):
    """Allows hot-swapping model artifacts via multipart file uploads."""
    saved = []
    if model_file is not None:
        MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
        with MODEL_PATH.open("wb") as buffer:
            shutil.copyfileobj(model_file.file, buffer)
        saved.append("model")
        
    if features_file is not None:
        FEATURES_PATH.parent.mkdir(parents=True, exist_ok=True)
        with FEATURES_PATH.open("wb") as buffer:
            shutil.copyfileobj(features_file.file, buffer)
        saved.append("features")

    if scaler_file is not None:
        SCALER_PATH.parent.mkdir(parents=True, exist_ok=True)
        with SCALER_PATH.open("wb") as buffer:
            shutil.copyfileobj(scaler_file.file, buffer)
        saved.append("scaler")

    model_manager.load_or_reload()
    return {
        "status": "success",
        "message": f"Successfully uploaded and hot-swapped: {', '.join(saved)}" if saved else "No files uploaded.",
    }
