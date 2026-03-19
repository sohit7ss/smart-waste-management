from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
import models
from database import get_db
from middleware.auth_middleware import get_current_active_user, require_role

router = APIRouter(prefix="/fleet", tags=["fleet"])

# In-memory truck store (simulates GPS-updated trucks)
trucks_db = [
    {
        "id": 1,
        "van_id": "VAN-001",
        "driver_name": "Ramesh Kumar",
        "driver_phone": "+91-9876543210",
        "lat": 28.6139,
        "lng": 77.2090,
        "speed": 0,
        "status": "idle",
        "fuel_level": 85,
        "current_route_id": None,
        "completed_stops": 0,
        "total_stops": 0,
        "last_updated": datetime.now().isoformat()
    },
    {
        "id": 2,
        "van_id": "VAN-002",
        "driver_name": "Suresh Singh",
        "driver_phone": "+91-9876543211",
        "lat": 28.6200,
        "lng": 77.2100,
        "speed": 35,
        "status": "on_route",
        "fuel_level": 62,
        "current_route_id": 1,
        "completed_stops": 1,
        "total_stops": 3,
        "last_updated": datetime.now().isoformat()
    },
    {
        "id": 3,
        "van_id": "VAN-003",
        "driver_name": "Mahesh Yadav",
        "driver_phone": "+91-9876543212",
        "lat": 28.6250,
        "lng": 77.2050,
        "speed": 0,
        "status": "collecting",
        "fuel_level": 91,
        "current_route_id": 2,
        "completed_stops": 2,
        "total_stops": 4,
        "last_updated": datetime.now().isoformat()
    }
]


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
def get_truck(truck_id: int):
    """Get a specific truck's data."""
    for truck in trucks_db:
        if truck["id"] == truck_id:
            return truck
    raise HTTPException(status_code=404, detail="Truck not found")


@router.put("/trucks/{truck_id}/location")
async def update_truck_location(truck_id: int, data: dict):
    """Update truck GPS location. Called by IoT simulator or real GPS device."""
    from routes.websocket_routes import manager
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
                await manager.broadcast({
                    "type": "truck_location_update",
                    "truck": truck
                })
            except Exception:
                pass

            return {"message": "Location updated!", "truck": truck}

    raise HTTPException(status_code=404, detail="Truck not found")


@router.put("/trucks/{truck_id}/assign")
def assign_truck_to_route(truck_id: int, data: dict):
    """Assign a truck to a route."""
    for truck in trucks_db:
        if truck["id"] == truck_id:
            truck["current_route_id"] = data.get("route_id")
            truck["total_stops"] = data.get("total_stops", 0)
            truck["completed_stops"] = 0
            truck["status"] = "on_route"
            truck["last_updated"] = datetime.now().isoformat()
            return {"message": f"{truck['van_id']} assigned to route!", "truck": truck}
    raise HTTPException(status_code=404, detail="Truck not found")


@router.get("/trucks/{truck_id}/history")
def get_truck_history(truck_id: int):
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
