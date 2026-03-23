from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
import models
from database import get_db
from middleware.auth_middleware import get_current_active_user, require_role

router = APIRouter(prefix="/fleet", tags=["fleet"])


def _default_trucks():
    """Return fresh default truck data (Delhi coordinates)."""
    return [
        {
            "id": "VAN-001",
            "driver": "Ramesh Kumar", 
            "phone": "+91-9876543210",
            "lat": 28.6200, "lng": 77.2100,
            "status": "idle", "speed": 0,
            "fuel_level": 85,
            "current_route_id": None,
            "completed_stops": 0,
            "total_stops": 0,
            "last_updated": datetime.now().isoformat()
        },
        {
            "id": "VAN-002",
            "driver": "Suresh Singh",
            "phone": "+91-9876543211", 
            "lat": 28.6350, "lng": 77.2250,
            "status": "on_route", "speed": 35,
            "fuel_level": 62,
            "current_route_id": 1,
            "completed_stops": 1,
            "total_stops": 3,
            "last_updated": datetime.now().isoformat()
        },
        {
            "id": "VAN-003",
            "driver": "Mahesh Verma",
            "phone": "+91-9876543212",
            "lat": 28.5900, "lng": 77.2150,
            "status": "collecting", "speed": 0,
            "fuel_level": 91,
            "current_route_id": 2,
            "completed_stops": 2,
            "total_stops": 4,
            "last_updated": datetime.now().isoformat()
        }
    ]


# In-memory truck store (Ludhiana coordinates)
trucks_db = _default_trucks()


@router.post("/reset-demo")
def reset_fleet_demo():
    """Reset fleet trucks to default demo data."""
    global trucks_db
    trucks_db = _default_trucks()
    return {"success": True, "message": "Fleet demo data reset", "total": len(trucks_db)}


@router.get("/trucks")
def get_all_trucks():
    """Get all fleet trucks with live status."""
    return {
        "trucks": trucks_db,
        "total": len(trucks_db),
        "active": len([t for t in trucks_db if t["status"] != "idle"]),
        "idle": len([t for t in trucks_db if t["status"] == "idle"])
    }


@router.get("/trucks/{truck_id}")
def get_truck(truck_id: str):
    """Get a specific truck's data."""
    for truck in trucks_db:
        if truck["id"] == truck_id:
            return truck
    raise HTTPException(status_code=404, detail="Truck not found")


@router.patch("/trucks/{truck_id}/location")
async def update_truck_location(truck_id: str, data: dict):
    """Update truck GPS location. Called by driver view or real GPS device."""
    from routes.websocket_routes import manager
    import json
    for truck in trucks_db:
        if truck["id"] == truck_id:
            truck["lat"] = data["lat"]
            truck["lng"] = data["lng"]
            truck["speed"] = data.get("speed", 0)
            truck["fuel_level"] = data.get("fuel_level", truck["fuel_level"])
            truck["status"] = data.get("status", truck["status"])
            truck["last_updated"] = datetime.now().isoformat()

            # Broadcast real-time update via WebSocket
            try:
                await manager.broadcast(json.dumps({
                    "type": "truck_update",
                    "truck": {
                        "id": truck_id,
                        "lat": data["lat"],
                        "lng": data["lng"],
                        "status": truck.get("status")
                    }
                }))
            except Exception:
                pass

            return {"message": "Location updated!", "truck": truck}

    raise HTTPException(status_code=404, detail="Truck not found")


@router.put("/trucks/{truck_id}/assign")
def assign_truck_to_route(truck_id: str, data: dict):
    """Assign a truck to a route."""
    for truck in trucks_db:
        if truck["id"] == truck_id:
            truck["current_route_id"] = data.get("route_id")
            truck["total_stops"] = data.get("total_stops", 0)
            truck["completed_stops"] = 0
            truck["status"] = "on_route"
            truck["last_updated"] = datetime.now().isoformat()
            return {"message": f"{truck['id']} assigned to route!", "truck": truck}
    raise HTTPException(status_code=404, detail="Truck not found")


@router.get("/trucks/{truck_id}/history")
def get_truck_history(truck_id: str):
    """Get historical route data for a truck."""
    return {
        "truck_id": truck_id,
        "route_history": [
            {
                "date": "2026-03-19",
                "routes_completed": 3,
                "distance_km": 24.5,
                "bins_collected": 8,
                "fuel_used_liters": 2.1
            },
            {
                "date": "2026-03-18",
                "routes_completed": 2,
                "distance_km": 18.2,
                "bins_collected": 6,
                "fuel_used_liters": 1.6
            },
            {
                "date": "2026-03-17",
                "routes_completed": 4,
                "distance_km": 31.8,
                "bins_collected": 12,
                "fuel_used_liters": 3.0
            }
        ]
    }


@router.get("/performance")
def fleet_performance():
    """Get driver performance metrics for today."""
    return {
        "drivers": [
            {
                "van_id":          "VAN-001",
                "driver_name":     "Ramesh Kumar",
                "bins_today":      8,
                "avg_response":    "12 mins",
                "distance_today":  "24.5 km",
                "rating":          4.8,
                "status":          "on_route"
            },
            {
                "van_id":          "VAN-002",
                "driver_name":     "Suresh Singh",
                "bins_today":      6,
                "avg_response":    "15 mins",
                "distance_today":  "18.2 km",
                "rating":          4.5,
                "status":          "collecting"
            },
            {
                "van_id":          "VAN-003",
                "driver_name":     "Mahesh Yadav",
                "bins_today":      5,
                "avg_response":    "18 mins",
                "distance_today":  "15.8 km",
                "rating":          4.2,
                "status":          "idle"
            },
        ],
        "total_bins_today":     19,
        "total_distance_today": "58.5 km",
        "active_trucks":        2,
        "idle_trucks":          1
    }


@router.post("/dispatch")
async def dispatch_truck(data: dict):
    """Manually dispatch a truck to a specific bin."""
    from routes.websocket_routes import manager

    truck_id = data.get("truck_id")
    bin_id   = data.get("bin_id")
    reason   = data.get("reason", "manual_dispatch")

    for truck in trucks_db:
        if truck["id"] == truck_id:
            truck["status"]        = "on_route"
            truck["assigned_bin"]  = bin_id
            truck["dispatched_at"] = datetime.now().isoformat()

            await manager.broadcast({
                "type":   "truck_dispatched",
                "notification": {
                    "truck_id":    truck["id"],
                    "van_id":      truck["id"],
                    "driver_name": truck["driver"],
                    "bin_id":      bin_id,
                    "reason":      reason,
                    "message":     f"{truck['id']} dispatched to Bin #{bin_id}!",
                    "timestamp":   datetime.now().isoformat()
                }
            })

            return {
                "success": True,
                "message": f"{truck['id']} dispatched to Bin #{bin_id}!",
                "truck":   truck
            }

    raise HTTPException(status_code=404, detail="Truck not found")
