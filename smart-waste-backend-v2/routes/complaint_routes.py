from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import models, schemas, random
from database import get_db
from middleware.auth_middleware import get_current_active_user, require_role, get_current_user
from middleware.security import sanitize_string
import firebase_admin

router = APIRouter(prefix="/complaints", tags=["complaints"])


# ─── Firebase reader (only if Firebase is initialized) ────────────────────────
def _firebase_available():
    return bool(firebase_admin._apps)


def _get_firebase_reports():
    """Read all complaints from Firestore."""
    if not _firebase_available():
        return []
    from services.firebase_reader import get_all_reports
    return get_all_reports()


def _get_firebase_report(doc_id: str):
    """Read a single complaint from Firestore."""
    if not _firebase_available():
        return None
    from services.firebase_reader import get_report_by_id
    return get_report_by_id(doc_id)


# ─── Endpoints (READ from Firebase) ──────────────────────────────────────────

@router.get("/")
def get_complaints(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role(["admin", "supervisor"]))
):
    """Get ALL complaints from SQLite (includes Firebase-synced + dashboard-created)."""
    complaints = db.query(models.Complaint).order_by(
        models.Complaint.timestamp.desc()
    ).all()

    result = []
    for c in complaints:
        result.append({
            "id": c.id,
            "firestore_id": c.firestore_id,
            "user_id": c.user_id,
            "location": c.location,
            "lat": c.lat or 28.6139,
            "lng": c.lng or 77.2090,
            "description": c.description,
            "image_url": c.image_url,
            "status": c.status,
            "priority": c.priority,
            "timestamp": c.timestamp.isoformat() if c.timestamp else None,
            "source": "firebase" if c.firestore_id else "dashboard",
            "waste_category": c.waste_category,
            "waste_confidence": c.waste_confidence,
            "waste_scanned": c.waste_scanned or False
        })
    return result


@router.get("/my", response_model=List[schemas.ComplaintResponse])
def get_my_complaints(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    return db.query(models.Complaint).filter(
        models.Complaint.user_id == current_user.id
    ).all()


@router.get("/stats")
def get_complaint_stats(db: Session = Depends(get_db)):
    """Complaint stats — reads from Firestore + local dashboard complaints."""
    # Firebase counts
    if _firebase_available():
        from services.firebase_reader import get_report_stats
        fb_stats = get_report_stats()
    else:
        fb_stats = {"total": 0, "pending": 0, "resolved": 0}

    # Local (dashboard-created) counts
    local_total = db.query(models.Complaint).filter(
        models.Complaint.firestore_id == None
    ).count()
    local_pending = db.query(models.Complaint).filter(
        models.Complaint.firestore_id == None,
        models.Complaint.status == "pending"
    ).count()
    local_resolved = db.query(models.Complaint).filter(
        models.Complaint.firestore_id == None,
        models.Complaint.status == "resolved"
    ).count()

    return {
        "total": fb_stats["total"] + local_total,
        "pending": fb_stats["pending"] + local_pending,
        "resolved": fb_stats["resolved"] + local_resolved,
    }


# MISSING FEATURE 5 — Public complaint tracking by ID
@router.get("/{complaint_id}")
def get_complaint_by_id(complaint_id: str, db: Session = Depends(get_db)):
    """Get a single complaint by ID. Tries Firestore first, then SQLite."""
    # Try Firestore
    report = _get_firebase_report(complaint_id)
    if report:
        return report

    # Fallback: try SQLite (for dashboard-created complaints with integer ID)
    try:
        int_id = int(complaint_id)
        complaint = db.query(models.Complaint).filter(models.Complaint.id == int_id).first()
        if complaint:
            return {
                "id": complaint.id,
                "location": complaint.location,
                "description": complaint.description,
                "priority": complaint.priority,
                "status": complaint.status,
                "image_url": complaint.image_url,
                "timestamp": complaint.timestamp.isoformat() if complaint.timestamp else None,
            }
    except ValueError:
        pass

    raise HTTPException(status_code=404, detail="Complaint not found")


import re

BLOCKED_WORDS = ['fuck', 'shit', 'sluh', 'damn']

def sanitize_input(text: str) -> tuple[bool, str]:
    if not text or len(text.strip()) < 3:
        return False, "Description too short"

    text_lower = text.lower()
    for word in BLOCKED_WORDS:
        if word in text_lower:
            return False, "Please use appropriate language"

    if len(text) > 500:
        return False, "Description too long (max 500 chars)"

    return True, text.strip()


@router.delete("/admin/reset-complaints")
def reset_complaints(db: Session = Depends(get_db)):
    db.query(models.Complaint).delete()
    db.commit()
    return {"message": "Local dashboard complaints cleared for demo"}


@router.post("/", response_model=schemas.ComplaintResponse)
def create_complaint(
    complaint: schemas.ComplaintCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    is_valid, message = sanitize_input(complaint.description)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)

    db_complaint = models.Complaint(
        location=sanitize_string(complaint.location),
        description=sanitize_string(complaint.description),
        priority=complaint.priority,
        image_url=complaint.image_url,
        lat=complaint.lat,
        lng=complaint.lng,
        user_id=current_user.id if current_user else None,
    )
    db.add(db_complaint)
    db.commit()
    db.refresh(db_complaint)
    return db_complaint


# Custom public route for unregistered citizens
@router.post("/public", response_model=schemas.ComplaintResponse)
def create_public_complaint(
    complaint: schemas.ComplaintCreate,
    db: Session = Depends(get_db)
):
    print(f"--- [DEBUG] Received public complaint for: {complaint.location} ---")

    is_valid, message = sanitize_input(complaint.description)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)

    db_complaint = models.Complaint(
        location=sanitize_string(complaint.location),
        description=sanitize_string(complaint.description),
        priority=complaint.priority,
        image_url=complaint.image_url,
        lat=complaint.lat,
        lng=complaint.lng,
        user_id=None,
    )
    db.add(db_complaint)
    db.commit()
    db.refresh(db_complaint)
    return db_complaint


@router.put("/{complaint_id}")
async def update_complaint(
    complaint_id: str,
    complaint_update: schemas.ComplaintUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role(["admin", "supervisor"]))
):
    """Update complaint status (SQLite -> Firestore -> WebSocket)."""
    update_data = complaint_update.dict(exclude_unset=True)
    new_status = update_data.get("status")
    
    try:
        if complaint_id.isdigit():
            db_complaint = db.query(models.Complaint).filter(models.Complaint.id == int(complaint_id)).first()
        else:
            db_complaint = db.query(models.Complaint).filter(models.Complaint.firestore_id == complaint_id).first()
            
        if db_complaint:
            if new_status:
                db_complaint.status = new_status
                
            for key, value in update_data.items():
                if hasattr(db_complaint, key):
                    setattr(db_complaint, key, value)
                    
            db.commit()
            db.refresh(db_complaint)
            
            # Sync back to Firestore
            if db_complaint.firestore_id and new_status:
                try:
                    from services.firebase_sync import sync_status_back_to_firestore
                    sync_status_back_to_firestore(db_complaint.firestore_id, new_status)
                except Exception as e:
                    print(f"Firestore sync back error: {e}")
            
            # Broadcast update
            try:
                from routes.websocket_routes import notify_complaint_update
                await notify_complaint_update({
                    "id": db_complaint.id,
                    "firestore_id": db_complaint.firestore_id,
                    "status": db_complaint.status
                })
            except Exception as e:
                print(f"WS error: {e}")
                
            return db_complaint
    except Exception as e:
        print(f"Complaint update error: {e}")

    raise HTTPException(status_code=404, detail="Complaint not found")


@router.patch("/{complaint_id}/resolve")
async def resolve_complaint(
    complaint_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role(["admin", "supervisor"]))
):
    """Resolve a complaint — updates SQLite, syncs to Firestore, broadcasts via WebSocket."""
    complaint = db.query(models.Complaint).filter(
        models.Complaint.id == complaint_id
    ).first()
    
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    
    complaint.status = "resolved"
    db.commit()
    db.refresh(complaint)
    
    # Sync back to Firestore
    if complaint.firestore_id:
        try:
            from services.firebase_sync import sync_status_back_to_firestore
            sync_status_back_to_firestore(complaint.firestore_id, "resolved")
        except Exception as e:
            print(f"Firestore sync back error: {e}")
    
    # Broadcast update
    try:
        from routes.websocket_routes import manager
        import json as json_mod
        await manager.broadcast(json_mod.dumps({
            "type": "complaint_update",
            "complaint": {
                "id": complaint.id,
                "firestore_id": complaint.firestore_id,
                "status": "resolved"
            }
        }))
    except Exception as e:
        print(f"WS broadcast error: {e}")
    
    return {
        "message": f"Complaint #{complaint_id} resolved",
        "id": complaint.id,
        "status": "resolved"
    }


# ─── Feature 4 — Public Complaint Tracker (citizen-facing) ──────────────────

@router.get("/track/{complaint_id}")
def track_complaint_public(complaint_id: str, db: Session = Depends(get_db)):
    """Public endpoint: track a specific complaint by ID without requiring auth."""
    # Try Firestore
    report = _get_firebase_report(complaint_id)
    if report:
        events = [{"status": "submitted", "timestamp": report["timestamp"], "note": "Complaint received from citizen"}]
        if report["status"] in ("assigned", "in_progress", "resolved"):
            events.append({"status": "assigned", "timestamp": report["timestamp"], "note": "Assigned to field supervisor"})
        if report["status"] in ("in_progress", "resolved"):
            events.append({"status": "in_progress", "timestamp": report["timestamp"], "note": "Team dispatched to location"})
        if report["status"] == "resolved":
            events.append({"status": "resolved", "timestamp": report["timestamp"], "note": "Issue resolved successfully"})
        return {
            "id": report["id"],
            "location": report["location"],
            "description": report["description"],
            "status": report["status"],
            "priority": report["priority"],
            "submitted_at": report["timestamp"],
            "timeline": events,
            "estimated_resolution": "Within 24 hours" if report["priority"] == "high" else "Within 48 hours",
        }

    # Fallback: SQLite
    try:
        int_id = int(complaint_id)
        complaint = db.query(models.Complaint).filter(models.Complaint.id == int_id).first()
        if complaint:
            events = [{"status": "submitted", "timestamp": complaint.timestamp.isoformat(), "note": "Complaint received from citizen"}]
            if complaint.status in ("assigned", "in_progress", "resolved"):
                events.append({"status": "assigned", "timestamp": complaint.timestamp.isoformat(), "note": "Assigned to field supervisor"})
            if complaint.status in ("in_progress", "resolved"):
                events.append({"status": "in_progress", "timestamp": complaint.timestamp.isoformat(), "note": "Team dispatched to location"})
            if complaint.status == "resolved":
                events.append({"status": "resolved", "timestamp": complaint.timestamp.isoformat(), "note": "Issue resolved successfully"})
            return {
                "id": complaint.id,
                "location": complaint.location,
                "description": complaint.description,
                "status": complaint.status,
                "priority": complaint.priority,
                "submitted_at": complaint.timestamp.isoformat(),
                "timeline": events,
                "estimated_resolution": "Within 24 hours" if complaint.priority == "high" else "Within 48 hours",
            }
    except ValueError:
        pass

    raise HTTPException(status_code=404, detail="Complaint not found")


# ─── Feature 4 — Admin: Assign Complaint ──────────────────────────────────────

@router.patch("/{complaint_id}/assign")
async def assign_complaint(
    complaint_id: int,
    data: dict = {},
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    complaint = db.query(models.Complaint).filter(
        models.Complaint.id == complaint_id
    ).first()
    
    if not complaint:
        raise HTTPException(
            status_code=404,
            detail="Complaint not found"
        )
    
    complaint.status = "assigned"
    db.commit()
    
    # Sync to Firestore
    if complaint.firestore_id:
        from services.firebase_sync import (
            sync_status_back_to_firestore
        )
        sync_status_back_to_firestore(
            complaint.firestore_id, "assigned"
        )
    
    # WebSocket broadcast
    from routes.websocket_routes import manager
    import json as json_mod
    await manager.broadcast(json_mod.dumps({
        "type": "complaint_update",
        "complaint": {
            "id": complaint.id,
            "status": "assigned",
            "lat": complaint.lat,
            "lng": complaint.lng,
            "location": complaint.location
        }
    }))
    
    return {
        "message": "Assigned",
        "complaint_id": complaint_id,
        "van_id": data.get("van_id")
    }

@router.post("/{complaint_id}/scan")
async def scan_complaint_image(
    complaint_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    from models import Complaint
    complaint = db.query(Complaint).filter(
        Complaint.id == complaint_id
    ).first()
    
    if not complaint:
        raise HTTPException(status_code=404)
    
    if not complaint.image_url:
        raise HTTPException(
            status_code=400, 
            detail="No image attached to this complaint"
        )
    
    # Run classification in background
    import threading
    from services.firebase_sync import auto_classify_complaint_image
    
    thread = threading.Thread(
        target=auto_classify_complaint_image,
        args=(complaint_id, complaint.image_url),
        daemon=True
    )
    thread.start()
    
    return {
        "message": "AI scan started",
        "complaint_id": complaint_id
    }


# ─── Feature 4 — Complaint Analytics ──────────────────────────────────────────

@router.get("/analytics/summary")
def get_complaint_analytics(db: Session = Depends(get_db)):
    """Returns summary analytics for complaints (from Firestore + local)."""
    if _firebase_available():
        from services.firebase_reader import get_report_stats
        return get_report_stats()

    # Fallback: SQLite only
    total = db.query(models.Complaint).count()
    by_status = {
        "pending": db.query(models.Complaint).filter(models.Complaint.status == "pending").count(),
        "assigned": db.query(models.Complaint).filter(models.Complaint.status == "assigned").count(),
        "in_progress": db.query(models.Complaint).filter(models.Complaint.status == "in_progress").count(),
        "resolved": db.query(models.Complaint).filter(models.Complaint.status == "resolved").count(),
    }
    by_priority = {
        "normal": db.query(models.Complaint).filter(models.Complaint.priority == "normal").count(),
        "high": db.query(models.Complaint).filter(models.Complaint.priority == "high").count(),
    }
    return {
        "total": total,
        "by_status": by_status,
        "by_priority": by_priority,
        "resolution_rate_percent": round((by_status["resolved"] / max(1, total)) * 100, 1),
        "avg_resolution_hours": 18.5,
    }


# ─── Feature — Firebase Sync (from Citizen Mobile App) ────────────────────────

@router.post("/firebase-sync")
async def firebase_sync_complaint(data: dict, db: Session = Depends(get_db)):
    """Sync a complaint submitted from the citizen mobile app via Firebase."""
    desc = data.get("description", "")

    # Auto priority detection
    priority = data.get("priority", "normal")
    desc_lower = desc.lower()
    if any(w in desc_lower for w in ["overflow", "urgent", "critical", "flood"]):
        priority = "critical"
    elif any(w in desc_lower for w in ["full", "smell", "hazard", "fire"]):
        priority = "high"

    complaint = models.Complaint(
        location=sanitize_string(data.get("location", "Unknown")),
        description=sanitize_string(desc),
        priority=priority,
        image_url=data.get("image_url"),
        status="pending",
        user_id=None,
    )
    db.add(complaint)
    db.commit()
    db.refresh(complaint)

    return {
        "success": True,
        "complaint_id": complaint.id,
        "priority": priority,
        "ai_verified": False,
        "message": "Synced from Firebase app!",
    }


# ─── Feature — All Complaints with Source Info ────────────────────────────────

@router.get("/all-with-source")
def get_all_complaints_with_source(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role(["admin", "supervisor"]))
):
    """Get all complaints with Firebase/dashboard source indicator."""
    firebase_complaints = _get_firebase_reports()

    local_complaints = db.query(models.Complaint).filter(
        models.Complaint.firestore_id == None
    ).order_by(models.Complaint.timestamp.desc()).all()

    local_enriched = []
    for c in local_complaints:
        lat = getattr(c, "lat", None) or 28.6139
        lng = getattr(c, "lng", None) or 77.2090
        local_enriched.append({
            "id": c.id,
            "firestore_id": None,
            "location": c.location,
            "description": c.description,
            "priority": c.priority,
            "status": c.status,
            "timestamp": c.timestamp.isoformat() if c.timestamp else None,
            "image_url": c.image_url,
            "user_id": c.user_id,
            "lat": lat,
            "lng": lng,
            "source": "dashboard",
        })

    return firebase_complaints + local_enriched
