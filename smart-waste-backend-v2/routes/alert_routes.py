from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
import models
from database import get_db
from middleware.auth_middleware import get_current_active_user

router = APIRouter(prefix="/alerts", tags=["alerts"])

# In-memory alert store (supplement to DB alerts)
alerts_store = []


def check_and_create_alerts(bin_data: dict, db: Session):
    """Check bin data and auto-generate alerts for overflow, warning, and low battery."""
    alerts = []
    
    from datetime import timedelta
    cutoff = datetime.utcnow() - timedelta(minutes=30)
    
    def alert_exists(type_name):
        return db.query(models.Alert).filter(
            models.Alert.dustbin_id == bin_data["id"],
            models.Alert.type == type_name,
            models.Alert.resolved == False,
            models.Alert.timestamp > cutoff
        ).first() is not None

    if bin_data.get("fill_level", 0) >= 90:
        if not alert_exists("overflow"):
            alert = models.Alert(
                dustbin_id=bin_data["id"],
                type="overflow",
                message=f"CRITICAL: {bin_data.get('location', 'Unknown')} is overflowing ({bin_data['fill_level']}% full)!",
                resolved=False,
                timestamp=datetime.utcnow()
            )
            db.add(alert)
            alerts.append(alert)
            
    elif bin_data.get("fill_level", 0) >= 75:
        if not alert_exists("warning"):
            alert = models.Alert(
                dustbin_id=bin_data["id"],
                type="warning",
                message=f"WARNING: {bin_data.get('location', 'Unknown')} is almost full ({bin_data['fill_level']}%).",
                resolved=False,
                timestamp=datetime.utcnow()
            )
            db.add(alert)
            alerts.append(alert)

    if bin_data.get("battery", 100) < 20:
        if not alert_exists("battery"):
            alert = models.Alert(
                dustbin_id=bin_data["id"],
                type="battery",
                message=f"LOW BATTERY: Sensor at {bin_data.get('location', 'Unknown')} needs charging ({bin_data.get('battery')}%).",
                resolved=False,
                timestamp=datetime.utcnow()
            )
            db.add(alert)
            alerts.append(alert)

    if alerts:
        db.commit()
    
    return alerts


@router.get("/")
def get_alerts(db: Session = Depends(get_db)):
    """Get all unresolved alerts with severity breakdown."""
    all_alerts = db.query(models.Alert).filter(models.Alert.resolved == False).order_by(models.Alert.timestamp.desc()).all()
    
    serialized = []
    for a in all_alerts:
        severity = "critical" if a.type == "overflow" else "high" if a.type == "warning" else "medium"
        serialized.append({
            "id": a.id,
            "type": a.type,
            "severity": severity,
            "dustbin_id": a.dustbin_id,
            "message": a.message,
            "timestamp": a.timestamp.isoformat() if a.timestamp else None,
            "resolved": a.resolved
        })
    
    return {
        "alerts": serialized,
        "total": len(serialized),
        "critical": len([a for a in serialized if a["severity"] == "critical"]),
        "high": len([a for a in serialized if a["severity"] == "high"]),
        "medium": len([a for a in serialized if a["severity"] == "medium"])
    }


@router.put("/{alert_id}/resolve")
def resolve_alert(alert_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    """Mark an alert as resolved."""
    alert = db.query(models.Alert).filter(models.Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    alert.resolved = True
    db.commit()
    db.refresh(alert)
    
    return {
        "message": "Alert resolved!",
        "alert": {
            "id": alert.id,
            "type": alert.type,
            "resolved": alert.resolved,
            "dustbin_id": alert.dustbin_id
        }
    }
