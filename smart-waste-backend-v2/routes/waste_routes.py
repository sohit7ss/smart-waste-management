from fastapi import APIRouter, File, UploadFile, Depends
from fastapi.responses import JSONResponse
from ai.waste_classifier import classify_waste_type
from middleware.auth_middleware import get_current_user
from models import User
import uuid, os, shutil

router = APIRouter(prefix="/analyze", tags=["Waste Analysis"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/waste-type")
async def analyze_waste_type(
    file: UploadFile = File(...),
):
    """
    Classify waste type from uploaded image.
    Returns: category, confidence, circular economy info
    """
    # Save uploaded file temporarily
    temp_filename = f"{uuid.uuid4()}.jpg"
    temp_path = os.path.join(UPLOAD_DIR, temp_filename)
    
    try:
        with open(temp_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        
        result = classify_waste_type(temp_path)
        return JSONResponse(content={
            "success": True,
            "data": result
        })
    
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)}
        )
    finally:
        # Clean up temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)

@router.post("/dual-analysis")
async def dual_analysis(
    file: UploadFile = File(...),
    bin_id: int = None
):
    """
    Run BOTH fill level detection AND waste type classification
    on the same image at once. Used by phone camera page.
    """
    temp_filename = f"{uuid.uuid4()}.jpg"
    temp_path = os.path.join(UPLOAD_DIR, temp_filename)
    
    try:
        with open(temp_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        
        # Run waste classification
        waste_result = classify_waste_type(temp_path)
        
        # Run fill level detection (reuse existing detector)
        fill_result = None
        try:
            from ai.detector import WasteDetector
            detector = WasteDetector()
            # Note: The original ai.detector.py might have a detect() method, or an analyze() method.
            # I will use analyze() since we know that's what detector.py exposes.
            with open(temp_path, "rb") as image_f:
                 image_bytes = image_f.read()
            fill_result = detector.analyze(image_bytes)
        except Exception as e:
            fill_result = {"status": "unknown", "fill_level": 0, "error": str(e)}
        
        return JSONResponse(content={
            "success": True,
            "fill_level": fill_result,
            "waste_type": waste_result
        })
    
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)}
        )
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
