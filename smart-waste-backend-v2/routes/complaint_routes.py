from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import models, schemas
from database import get_db
from middleware.auth_middleware import get_current_active_user, require_role, get_current_user
from middleware.security import sanitize_string

router = APIRouter(prefix="/complaints", tags=["complaints"])


@router.get("/", response_model=List[schemas.ComplaintResponse])
def get_complaints(db: Session = Depends(get_db), current_user: models.User = Depends(require_role(["admin", "supervisor"]))):
    return db.query(models.Complaint).order_by(models.Complaint.timestamp.desc()).all()


@router.get("/my", response_model=List[schemas.ComplaintResponse])
def get_my_complaints(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    return db.query(models.Complaint).filter(models.Complaint.user_id == current_user.id).all()


@router.get("/stats")
def get_complaint_stats(db: Session = Depends(get_db)):
    total = db.query(models.Complaint).count()
    pending = db.query(models.Complaint).filter(models.Complaint.status == "pending").count()
    resolved = db.query(models.Complaint).filter(models.Complaint.status == "resolved").count()
    return {"total": total, "pending": pending, "resolved": resolved}


# MISSING FEATURE 5 — Public complaint tracking by ID
@router.get("/{complaint_id}")
def get_complaint_by_id(complaint_id: int, db: Session = Depends(get_db)):
    """Get a single complaint by ID (public, for citizen tracking)."""
    complaint = db.query(models.Complaint).filter(models.Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    return {
        "id": complaint.id,
        "location": complaint.location,
        "description": complaint.description,
        "priority": complaint.priority,
        "status": complaint.status,
        "image_url": complaint.image_url,
        "timestamp": complaint.timestamp.isoformat() if complaint.timestamp else None
    }


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
    return {"message": "Complaints cleared for demo"}

@router.post("/", response_model=schemas.ComplaintResponse)
def create_complaint(complaint: schemas.ComplaintCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    is_valid, message = sanitize_input(complaint.description)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)

    db_complaint = models.Complaint(
        location=sanitize_string(complaint.location),
        description=sanitize_string(complaint.description),
        priority=complaint.priority,
        image_url=complaint.image_url,
        user_id=current_user.id if current_user else None
    )
    db.add(db_complaint)
    db.commit()
    db.refresh(db_complaint)
    return db_complaint


# Custom public route for unregistered citizens
@router.post("/public", response_model=schemas.ComplaintResponse)
def create_public_complaint(complaint: schemas.ComplaintCreate, db: Session = Depends(get_db)):
    print(f"--- [DEBUG] Received public complaint for: {complaint.location} ---")
    
    is_valid, message = sanitize_input(complaint.description)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)

    db_complaint = models.Complaint(
        location=sanitize_string(complaint.location),
        description=sanitize_string(complaint.description),
        priority=complaint.priority,
        image_url=complaint.image_url,
        user_id=None
    )
    db.add(db_complaint)
    db.commit()
    db.refresh(db_complaint)
    return db_complaint


@router.put("/{complaint_id}", response_model=schemas.ComplaintResponse)
def update_complaint(complaint_id: int, complaint_update: schemas.ComplaintUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(require_role(["admin", "supervisor"]))):
    db_complaint = db.query(models.Complaint).filter(models.Complaint.id == complaint_id).first()
    if not db_complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    update_data = complaint_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_complaint, key, value)

    db.commit()
    db.refresh(db_complaint)
    return db_complaint


@router.put("/{complaint_id}", response_model=schemas.ComplaintResponse)
def update_complaint(complaint_id: int, complaint_update: schemas.ComplaintUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(require_role(["admin", "supervisor"]))):
    db_complaint = db.query(models.Complaint).filter(models.Complaint.id == complaint_id).first()
    if not db_complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    update_data = complaint_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_complaint, key, value)

    db.commit()
    db.refresh(db_complaint)
    return db_complaint


# ─── Feature 4 — Public Complaint Tracker (citizen-facing) ──────────────────

@router.get("/track/{complaint_id}")
def track_complaint_public(complaint_id: int, db: Session = Depends(get_db)):
    """Public endpoint: track a specific complaint by ID without requiring auth."""
    complaint = db.query(models.Complaint).filter(models.Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    # Build a timeline based on status
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
        "estimated_resolution": "Within 24 hours" if complaint.priority == "high" else "Within 48 hours"
    }


# ─── Feature 4 — Admin: Assign Complaint ──────────────────────────────────────

@router.put("/{complaint_id}/assign")
def assign_complaint(
    complaint_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role(["admin", "supervisor"]))
):
    """Assign a complaint to a driver/supervisor with priority update."""
    complaint = db.query(models.Complaint).filter(models.Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    if "priority" in data:
        complaint.priority = data["priority"]
    complaint.status = "assigned"

    db.commit()
    db.refresh(complaint)
    return {
        "message": f"Complaint #{complaint_id} assigned to {data.get('assignee', 'team')}",
        "complaint_id": complaint.id,
        "status": complaint.status,
        "priority": complaint.priority
    }


# ─── Feature 4 — Complaint Analytics ──────────────────────────────────────────

@router.get("/analytics/summary")
def get_complaint_analytics(db: Session = Depends(get_db)):
    """Returns summary analytics for complaints."""
    total = db.query(models.Complaint).count()
    by_status = {
        "pending":   db.query(models.Complaint).filter(models.Complaint.status == "pending").count(),
        "assigned":  db.query(models.Complaint).filter(models.Complaint.status == "assigned").count(),
        "in_progress": db.query(models.Complaint).filter(models.Complaint.status == "in_progress").count(),
        "resolved":  db.query(models.Complaint).filter(models.Complaint.status == "resolved").count(),
    }
    by_priority = {
        "normal": db.query(models.Complaint).filter(models.Complaint.priority == "normal").count(),
        "high":   db.query(models.Complaint).filter(models.Complaint.priority == "high").count(),
    }
    return {
        "total": total,
        "by_status": by_status,
        "by_priority": by_priority,
        "resolution_rate_percent": round((by_status["resolved"] / max(1, total)) * 100, 1),
        "avg_resolution_hours": 18.5
    }


# ─── Feature — Firebase Sync (from Citizen Mobile App) ────────────────────────

@router.post("/firebase-sync")
async def firebase_sync_complaint(data: dict, db: Session = Depends(get_db)):
    """Sync a complaint submitted from the citizen mobile app via Firebase."""
    desc = data.get("description", "")
    
    # Auto priority detection
    priority = data.get("priority", "normal")
    desc_lower = desc.lower()
    if any(w in desc_lower for w in ["overflow","urgent","critical","flood"]):
        priority = "critical"
    elif any(w in desc_lower for w in ["full","smell","hazard","fire"]):
        priority = "high"
        
    complaint = models.Complaint(
        location=sanitize_string(data.get("location", "Unknown")),
        description=sanitize_string(desc),
        priority=priority,
        image_url=data.get("image_url"),
        status="pending",
        user_id=None
    )
    db.add(complaint)
    db.commit()
    db.refresh(complaint)

    return {
        "success": True,
        "complaint_id": complaint.id,
        "priority": priority,
        "ai_verified": False,
        "message": "Synced from Firebase app!"
    }
