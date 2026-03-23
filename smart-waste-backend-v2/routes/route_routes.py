from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import json
import random
import string
import math
from datetime import datetime

import models
import schemas
from database import get_db
from middleware.auth_middleware import get_current_active_user, require_role
from routes.optimizer import optimize_route, calculate_distance
from routes.websocket_routes import manager

router = APIRouter(prefix="/routes", tags=["routes"])

# In-memory route store
routes_db = []
route_modifications_log = []


@router.get("")
@router.get("/")
async def get_routes(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    import json
    routes = db.query(models.Route).order_by(
        models.Route.created_at.desc()
    ).all()
    
    result = []
    for r in routes:
        stops = json.loads(r.stops) if r.stops else []
        coordinates = json.loads(r.coordinates) if r.coordinates else []
        result.append({
            "id": r.id,
            "van_id": r.van_id,
            "stops": stops,
            "stops_count": len(stops),
            "total_distance": r.total_distance or 0,
            "estimated_time": r.estimated_time or 0,
            "co2_saved": r.co2_saved or 0,
            "coordinates": coordinates,
            "status": r.status or "pending",
            "created_at": str(r.created_at)
        })
    return result


@router.get("/today")
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
async def generate_route(
    request: dict = {},
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    # Get priority bins
    priority_bins = db.query(models.Dustbin).filter(
        models.Dustbin.status.in_(["overflowing", "full"])
    ).all()
    
    if not priority_bins:
        priority_bins = db.query(models.Dustbin).all()
    
    if not priority_bins:
        raise HTTPException(
            status_code=400, 
            detail="No bins available for routing"
        )
    
    # Get available truck
    van_id = request.get("van_id", "VAN-001")
    
    # Calculate total distance using Haversine
    def haversine(lat1, lng1, lat2, lng2):
        import math
        R = 6371
        dlat = math.radians(lat2 - lat1)
        dlng = math.radians(lng2 - lng1)
        a = (math.sin(dlat/2)**2 + 
             math.cos(math.radians(lat1)) * 
             math.cos(math.radians(lat2)) * 
             math.sin(dlng/2)**2)
        return R * 2 * math.asin(math.sqrt(a))
    
    # Build stop list
    stops = []
    total_distance = 0.0
    
    # Start from depot (Delhi center)
    depot_lat, depot_lng = 28.6139, 77.2090
    current_lat, current_lng = depot_lat, depot_lng
    
    remaining = list(priority_bins)
    while remaining:
        nearest = min(remaining, key=lambda b: 
            haversine(current_lat, current_lng, b.lat, b.lng)
        )
        dist = haversine(
            current_lat, current_lng, nearest.lat, nearest.lng
        )
        total_distance += dist
        stops.append({
            "bin_id": nearest.id,
            "location": nearest.location,
            "lat": nearest.lat,
            "lng": nearest.lng,
            "fill_level": nearest.fill_level,
            "status": nearest.status,
            "distance_from_prev": round(dist, 2)
        })
        current_lat, current_lng = nearest.lat, nearest.lng
        remaining.remove(nearest)
    
    # Return distance to depot
    total_distance += haversine(
        current_lat, current_lng, depot_lat, depot_lng
    )
    total_distance = round(total_distance, 2)
    
    # Calculate metrics
    estimated_time = round(total_distance / 30 * 60)  # mins at 30kmh
    co2_saved = round(total_distance * 0.21, 2)  # kg CO2 per km
    
    # Build route coordinates for polyline
    coordinates = [[depot_lat, depot_lng]]
    for stop in stops:
        coordinates.append([stop["lat"], stop["lng"]])
    coordinates.append([depot_lat, depot_lng])
    
    # Save to database
    import json
    route = models.Route(
        van_id=van_id,
        stops=json.dumps(stops),
        total_distance=total_distance,
        estimated_time=estimated_time,
        status="pending",
        coordinates=json.dumps(coordinates),
        co2_saved=co2_saved,
        created_at=datetime.utcnow()
    )
    db.add(route)
    db.commit()
    db.refresh(route)
    
    # Broadcast via WebSocket
    await manager.broadcast(json.dumps({
        "type": "route_generated",
        "route": {
            "id": route.id,
            "van_id": van_id,
            "stops_count": len(stops),
            "total_distance": total_distance,
            "estimated_time": estimated_time,
            "co2_saved": co2_saved,
            "status": "pending"
        }
    }))
    
    return {
        "id": route.id,
        "van_id": van_id,
        "stops": stops,
        "stops_count": len(stops),
        "total_distance": total_distance,
        "estimated_time": estimated_time,
        "co2_saved": co2_saved,
        "coordinates": coordinates,
        "status": "pending",
        "created_at": str(route.created_at)
    }


@router.patch("/{route_id}")
async def update_route(
    route_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    route = db.query(models.Route).filter(
        models.Route.id == route_id
    ).first()
    if not route:
        raise HTTPException(status_code=404)
    
    if 'status' in data:
        route.status = data['status']
    if 'van_id' in data:
        route.van_id = data['van_id']
    
    db.commit()
    
    await manager.broadcast(json.dumps({
        "type": "route_update",
        "route": {
            "id": route.id,
            "status": route.status,
            "van_id": route.van_id
        }
    }))
    
    return {"message": "Updated", "id": route_id}

@router.put("/generated/{route_id}/assign")
def assign_generated_route(route_id: int, driver_name: str, van_id: str):
    """Assign a generated route to a named driver."""


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


@router.post("/notify-nearest-truck")
async def notify_nearest_truck(data: dict):
    """Find the nearest available truck and dispatch it to a bin."""
    from routes.fleet_routes import trucks_db
    from routes.websocket_routes import manager
    import math

    bin_id  = data.get("bin_id")
    bin_lat = data.get("lat")
    bin_lng = data.get("lng")
    reason  = data.get("reason", "bin_full")

    def distance(lat1, lng1, lat2, lng2):
        return math.sqrt((lat1 - lat2) ** 2 + (lng1 - lng2) ** 2)

    available = [
        t for t in trucks_db
        if t["status"] in ["idle", "on_route"]
        and t.get("lat") and t.get("lng")
    ]

    if not available:
        return {"success": False, "message": "No trucks available"}

    nearest = min(available, key=lambda t: distance(bin_lat, bin_lng, t["lat"], t["lng"]))
    dist = distance(bin_lat, bin_lng, nearest["lat"], nearest["lng"])
    eta_mins = max(round(dist * 111 * 2), 1)

    for truck in trucks_db:
        if truck["id"] == nearest["id"]:
            truck["status"]       = "on_route"
            truck["assigned_bin"] = bin_id
            truck["eta_minutes"]  = eta_mins

    notification = {
        "truck_id":    nearest["id"],
        "van_id":      nearest["van_id"],
        "driver_name": nearest["driver_name"],
        "bin_id":      bin_id,
        "reason":      reason,
        "eta_minutes": eta_mins,
        "message":     f"Truck {nearest['van_id']} dispatched! ETA: {eta_mins} mins",
        "timestamp":   datetime.now().isoformat()
    }

    await manager.broadcast({
        "type":         "truck_dispatched",
        "notification": notification
    })

    return {"success": True, "notification": notification}
