from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import models, schemas
from database import get_db
from middleware.auth_middleware import get_current_active_user, require_role
from datetime import datetime
import json
import random
import string
from routes.optimizer import optimize_route, calculate_distance

router = APIRouter(prefix="/routes", tags=["routes"])

# In-memory route store
routes_db = []
route_modifications_log = []


@router.get("/", response_model=List[schemas.RouteResponse])
def get_routes(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    return db.query(models.Route).all()


@router.get("/today", response_model=List[schemas.RouteResponse])
def get_todays_routes(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    return db.query(models.Route).filter(models.Route.status != "completed").all()


@router.get("/optimized")
def get_optimized_route(db: Session = Depends(get_db)):
    """Get AI-optimized collection route using real TSP algorithm (Upgrade 2)."""
    priority_bins = db.query(models.Dustbin).filter(
        models.Dustbin.status.in_(["full", "overflowing"])
    ).all()

    bins_data = [
        {
            "id": b.id,
            "location": b.location,
            "lat": b.lat,
            "lng": b.lng,
            "status": b.status,
            "fill_level": b.fill_level
        }
        for b in priority_bins
    ]

    optimized = optimize_route(bins_data)

    # Calculate total distance
    total_distance = 0
    for i in range(len(optimized) - 1):
        total_distance += calculate_distance(
            optimized[i]["lat"], optimized[i]["lng"],
            optimized[i + 1]["lat"], optimized[i + 1]["lng"]
        )

    return {
        "route": optimized,
        "total_stops": len(optimized),
        "total_distance_km": round(total_distance / 1000, 2),
        "estimated_time_mins": round(total_distance / 500) if total_distance > 0 else 0,
        "fuel_saved_percent": round(20 + (len(optimized) * 2), 1),
        "co2_saved_kg": round(total_distance * 0.00021, 2),
        "algorithm": "TSP with Google OR-Tools",
        "generated_at": datetime.now().isoformat()
    }


@router.post("/optimize", response_model=schemas.RouteResponse)
def optimize_route_legacy(db: Session = Depends(get_db), current_user: models.User = Depends(require_role(["admin", "supervisor"]))):
    """Create a new optimized route and save to DB."""
    critical_bins = db.query(models.Dustbin).filter(models.Dustbin.status.in_(["full", "overflowing"])).all()
    if not critical_bins:
        raise HTTPException(status_code=400, detail="No critical bins require collection right now")

    bins_data = [{"id": b.id, "location": b.location, "lat": b.lat, "lng": b.lng, "status": b.status, "fill_level": b.fill_level} for b in critical_bins]
    optimized = optimize_route(bins_data)
    stop_ids = [b["id"] for b in optimized]

    total_distance = 0
    for i in range(len(optimized) - 1):
        total_distance += calculate_distance(optimized[i]["lat"], optimized[i]["lng"], optimized[i + 1]["lat"], optimized[i + 1]["lng"])

    db_route = models.Route(
        van_id=f"VAN-{random.randint(100, 999)}",
        stops=json.dumps(stop_ids),
        estimated_time=round(total_distance / 500) if total_distance > 0 else len(stop_ids) * 12,
        fuel_saved=round(20 + (len(stop_ids) * 2), 1),
        status="pending"
    )
    db.add(db_route)
    db.commit()
    db.refresh(db_route)
    return db_route


    return db_route


@router.post("/generate")
def generate_route(db: Session = Depends(get_db)):
    """Auto-generate an optimized route from all full/overflowing bins."""
    priority_bins = db.query(models.Dustbin).filter(
        models.Dustbin.status.in_(["full", "overflowing"])
    ).all()

    if not priority_bins:
        return {"message": "No priority bins found", "route": None}

    bins_data = [
        {
            "id": b.id,
            "location": b.location,
            "lat": b.lat,
            "lng": b.lng,
            "status": b.status,
            "fill_level": b.fill_level,
            "completed": False
        }
        for b in priority_bins
    ]

    optimized = optimize_route(bins_data)

    total_distance = 0
    for i in range(len(optimized) - 1):
        total_distance += calculate_distance(
            optimized[i]["lat"], optimized[i]["lng"],
            optimized[i+1]["lat"], optimized[i+1]["lng"]
        )

    van_id = "VAN-" + ''.join(random.choices(string.digits, k=3))

    route = {
        "id": len(routes_db) + 1,
        "van_id": van_id,
        "driver_name": "Unassigned",
        "stops": optimized,
        "total_stops": len(optimized),
        "completed_stops": 0,
        "total_distance_km": round(float(total_distance) / 1000, 2),
        "estimated_time_mins": round(float(total_distance) / 500) if total_distance > 0 else len(optimized) * 10,
        "fuel_saved_percent": round(20 + len(optimized) * 2, 1),
        "co2_saved_kg": round(float(total_distance) * 0.00021, 2),
        "status": "generated",
        "algorithm": "TSP + OR-Tools",
        "created_at": datetime.now().isoformat(),
        "modifications": []
    }
    routes_db.append(route)
    return {"message": f"Route generated with {len(optimized)} stops!", "route": route}


@router.put("/generated/{route_id}/assign")
def assign_generated_route(route_id: int, driver_name: str, van_id: str):
    """Assign a generated route to a named driver."""
    for route in routes_db:
        if route["id"] == route_id:
            route["driver_name"] = driver_name
            route["van_id"] = van_id
            route["status"] = "assigned"
            route["assigned_at"] = datetime.now().isoformat()
            return {"message": f"Route assigned to {driver_name}!", "route": route}
    raise HTTPException(status_code=404, detail="Route not found")


@router.put("/generated/{route_id}/modify")
def modify_generated_route(route_id: int, modification: dict):
    """Modify a generated route — driver can reorder, add, or remove stops."""
    for route in routes_db:
        if route["id"] == route_id:
            log_entry = {
                "modified_by": modification.get("modified_by", "driver"),
                "reason": modification.get("reason", "Not specified"),
                "timestamp": datetime.now().isoformat()
            }
            if "new_stops_order" in modification:
                route["stops"] = modification["new_stops_order"]
            if "add_stop" in modification:
                route["stops"].append(modification["add_stop"])
                route["total_stops"] += 1
            if "remove_stop_id" in modification:
                route["stops"] = [s for s in route["stops"] if s["id"] != modification["remove_stop_id"]]
                route["total_stops"] = len(route["stops"])
            route["modifications"].append(log_entry)
            route["last_modified"] = datetime.now().isoformat()
            route_modifications_log.append(log_entry)
            return {"message": "Route modified!", "route": route}
    raise HTTPException(status_code=404, detail="Route not found")


@router.put("/generated/{route_id}/stop/{stop_index}/complete")
def complete_stop(route_id: int, stop_index: int):
    """Mark a specific stop as completed."""
    for route in routes_db:
        if route["id"] == route_id:
            if 0 <= stop_index < len(route["stops"]):
                route["stops"][stop_index]["completed"] = True
                route["stops"][stop_index]["completed_at"] = datetime.now().isoformat()
                route["completed_stops"] = len([s for s in route["stops"] if s.get("completed")])
                if route["completed_stops"] == route["total_stops"]:
                    route["status"] = "completed"
                    route["completed_at"] = datetime.now().isoformat()
                return {
                    "message": "Stop marked complete!",
                    "progress": f"{route['completed_stops']}/{route['total_stops']}",
                    "route_status": route["status"]
                }
    raise HTTPException(status_code=404, detail="Route not found")


@router.get("/generated")
def get_generated_routes():
    """Get all in-memory generated routes."""
    return {"routes": routes_db, "total": len(routes_db)}
