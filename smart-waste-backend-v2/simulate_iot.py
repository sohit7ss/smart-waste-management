import requests
import random
import time
import math
from datetime import datetime

SERVER_URL = "http://localhost:8000"
API_KEY    = "smartbin-iot-key-2026"

headers = {
    "X-API-Key":    API_KEY,
    "Content-Type": "application/json"
}

# ===== DUSTBIN SIMULATOR =====
dustbins = [
    {"id": 1, "fill_level": 90},
    {"id": 2, "fill_level": 50},
    {"id": 3, "fill_level": 10},
    {"id": 4, "fill_level": 100},
    {"id": 5, "fill_level": 60},
]

def get_status(fill_level):
    if fill_level >= 90: return "overflowing"
    if fill_level >= 60: return "full"
    if fill_level >= 30: return "half-full"
    return "empty"

# ===== TRUCK GPS SIMULATOR =====
trucks = [
    {
        "id": 1,
        "van_id": "VAN-001",
        "lat": 28.6139,
        "lng": 77.2090,
        "status": "on_route",
        "speed": 30,
        "fuel_level": 85.0,
        "route": [
            {"lat": 28.6139, "lng": 77.2090},
            {"lat": 28.6200, "lng": 77.2100},
            {"lat": 28.6250, "lng": 77.2050},
            {"lat": 28.6180, "lng": 77.2000},
        ],
        "route_index": 0
    },
    {
        "id": 2,
        "van_id": "VAN-002",
        "lat": 28.6300,
        "lng": 77.2150,
        "status": "collecting",
        "speed": 0,
        "fuel_level": 62.0,
        "route": [
            {"lat": 28.6300, "lng": 77.2150},
            {"lat": 28.6100, "lng": 77.2200},
            {"lat": 28.6050, "lng": 77.2080},
        ],
        "route_index": 0
    },
    {
        "id": 3,
        "van_id": "VAN-003",
        "lat": 28.5980,
        "lng": 77.2000,
        "status": "idle",
        "speed": 0,
        "fuel_level": 91.0,
        "route": [
            {"lat": 28.5980, "lng": 77.2000},
            {"lat": 28.6080, "lng": 77.1950},
        ],
        "route_index": 0
    }
]


def move_truck(truck):
    """Move truck incrementally along its route."""
    if truck["status"] == "idle":
        return

    if truck["route_index"] >= len(truck["route"]) - 1:
        # Loop back to start
        truck["route_index"] = 0
        truck["status"] = "returning"
        return

    target = truck["route"][truck["route_index"] + 1]

    # Move 8% of remaining distance per tick
    truck["lat"] += (target["lat"] - truck["lat"]) * 0.08
    truck["lng"] += (target["lng"] - truck["lng"]) * 0.08

    # Check if close enough to consider "arrived"
    dist = abs(truck["lat"] - target["lat"]) + abs(truck["lng"] - target["lng"])
    if dist < 0.0003:
        truck["route_index"] += 1
        truck["status"] = "collecting"
        truck["speed"] = 0
    else:
        truck["status"] = "on_route"
        truck["speed"] = random.randint(20, 45)

    # Gradual fuel consumption
    truck["fuel_level"] = max(0.0, truck["fuel_level"] - 0.03)


print("Starting IoT + GPS Truck Simulator...")
print("Simulating 5 dustbins + 3 GPS trucks")
print("Press Ctrl+C to stop\n")

cycle = 0
while True:
    cycle += 1

    # ---- Dustbin Updates ----
    for bin in dustbins:
        bin["fill_level"] = min(100, bin["fill_level"] + random.uniform(0.5, 2.0))
        status = get_status(bin["fill_level"])

        data = {
            "dustbin_id": bin["id"],
            "fill_level": round(bin["fill_level"], 1),
            "status":     status,
            "distance":   round(50 - (bin["fill_level"] * 0.5), 1),
            "battery":    round(random.uniform(60, 100), 1),
            "timestamp":  datetime.now().isoformat()
        }

        try:
            response = requests.post(
                f"{SERVER_URL}/iot/update",
                json=data,
                headers=headers,
                timeout=3
            )
            print(f"[BIN-{bin['id']}] Fill: {data['fill_level']}% | {status} | {response.status_code}")
        except Exception as e:
            print(f"[BIN-{bin['id']}] Connection error: {e}")

    # ---- Truck GPS Updates ----
    for truck in trucks:
        move_truck(truck)

        truck_data = {
            "lat": round(truck["lat"], 6),
            "lng": round(truck["lng"], 6),
            "speed": truck["speed"],
            "status": truck["status"],
            "fuel_level": round(truck["fuel_level"], 1)
        }

        try:
            response = requests.put(
                f"{SERVER_URL}/fleet/trucks/{truck['id']}/location",
                json=truck_data,
                timeout=3
            )
            print(f"[{truck['van_id']}] Lat: {truck_data['lat']:.4f} | Lng: {truck_data['lng']:.4f} | {truck['status']} | Fuel: {truck_data['fuel_level']}%")
        except Exception as e:
            print(f"[{truck['van_id']}] GPS error: {e}")

    print(f"\n--- Cycle {cycle} at {datetime.now().strftime('%H:%M:%S')} ---\n")
    time.sleep(10)
