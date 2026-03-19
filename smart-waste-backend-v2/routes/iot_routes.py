from fastapi import APIRouter, Security, HTTPException, Depends
from fastapi.security.api_key import APIKeyHeader
from sqlalchemy.orm import Session
from database import get_db
import models
from datetime import datetime
import base64
import os
import io
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/iot", tags=["iot"])

# Read IoT API key from .env
IOT_API_KEY = os.getenv("IOT_API_KEY", "smartbin-iot-key-2026")
api_key_header = APIKeyHeader(name="X-API-Key")


def verify_iot_device(api_key: str = Security(api_key_header)):
    if api_key != IOT_API_KEY:
        raise HTTPException(status_code=403, detail="Invalid IoT API Key")
    return api_key


@router.post("/update")
async def iot_update(
    data: dict,
    api_key: str = Security(verify_iot_device),
    db: Session = Depends(get_db)
):
    dustbin_id = data.get("dustbin_id")
    fill_level = data.get("fill_level")
    status = data.get("status")
    battery = data.get("battery", 100.0)

    bin_record = db.query(models.Dustbin).filter(models.Dustbin.id == dustbin_id).first()
    if bin_record:
        bin_record.fill_level = fill_level
        bin_record.status = status
        bin_record.battery = battery
        bin_record.last_updated = datetime.utcnow()

        # Auto-generate alerts for overflow/warning/low battery (Upgrade 4)
        try:
            from routes.alert_routes import check_and_create_alerts
            check_and_create_alerts({
                "id": bin_record.id,
                "location": bin_record.location,
                "fill_level": fill_level,
                "battery": battery
            }, db)
        except Exception as e:
            print(f"Alert check error: {e}")

        db.commit()
        db.refresh(bin_record)

        bin_data = {
            "id": bin_record.id,
            "location": bin_record.location,
            "status": bin_record.status,
            "fill_level": bin_record.fill_level,
            "battery": bin_record.battery,
            "lat": bin_record.lat,
            "lng": bin_record.lng
        }

        # Push live update via WebSocket (Upgrade 1)
        try:
            from routes.websocket_routes import notify_bin_update
            import asyncio
            asyncio.create_task(notify_bin_update(bin_data))
        except Exception as e:
            print(f"WebSocket notify error: {e}")

        return {
            "success": True,
            "message": "Dustbin updated successfully",
            "dustbin": bin_data
        }

    return {"success": False, "message": "Dustbin not found"}


@router.post("/image")
async def iot_image(
    data: dict,
    api_key: str = Security(verify_iot_device),
    db: Session = Depends(get_db)
):
    dustbin_id = data.get("dustbin_id")
    image_base64 = data.get("image")

    try:
        image_data = base64.b64decode(image_base64)
    except Exception:
        return {"success": False, "message": "Invalid base64 payload"}

    # Save image to uploads folder
    upload_dir = os.getenv("UPLOAD_DIR", "./uploads")
    os.makedirs(upload_dir, exist_ok=True)
    filename = f"bin_{dustbin_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
    filepath = os.path.join(upload_dir, filename)
    with open(filepath, "wb") as f:
        f.write(image_data)

    # Run AI analysis (MISSING FEATURE 1 — real YOLOv8 detector)
    try:
        from ai.detector import detector
        result = detector.analyze(image_data)
    except Exception as e:
        print(f"AI analysis error: {e}")
        result = {
            "status": "full",
            "fill_level": 90,
            "confidence": 0.0,
            "ai_powered": False,
            "mode": "fallback"
        }

    # Update bin in database
    bin_record = db.query(models.Dustbin).filter(models.Dustbin.id == dustbin_id).first()
    if bin_record:
        bin_record.status = result["status"]
        bin_record.fill_level = result["fill_level"]
        bin_record.last_updated = datetime.utcnow()
        db.commit()

    return {
        "success": True,
        "dustbin_id": dustbin_id,
        "image_saved": filename,
        **result
    }


@router.get("/devices")
async def get_iot_devices(
    api_key: str = Security(verify_iot_device),
    db: Session = Depends(get_db)
):
    bins = db.query(models.Dustbin).all()
    devices = []
    for bn in bins:
        devices.append({
            "dustbin_id": bn.id,
            "location": bn.location,
            "status": bn.status,
            "fill_level": bn.fill_level,
            "battery": bn.battery,
            "last_updated": bn.last_updated.isoformat() if bn.last_updated else "Never",
            "online": True
        })
    return {"devices": devices, "total": len(devices)}
