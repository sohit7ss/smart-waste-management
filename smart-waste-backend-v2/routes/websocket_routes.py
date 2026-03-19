from fastapi import WebSocket, WebSocketDisconnect
from typing import List
from datetime import datetime
import asyncio
import json

from database import SessionLocal
import models


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"✅ WebSocket client connected. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        print(f"❌ WebSocket client disconnected. Total: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)
        for conn in disconnected:
            if conn in self.active_connections:
                self.active_connections.remove(conn)


# Global WebSocket manager
manager = ConnectionManager()


async def websocket_dashboard(websocket: WebSocket):
    """WebSocket endpoint for live dashboard updates."""
    await manager.connect(websocket)
    try:
        while True:
            # Send live dustbin data every 5 seconds
            db = SessionLocal()
            try:
                bins = db.query(models.Dustbin).all()
                data = {
                    "type": "dustbin_update",
                    "timestamp": datetime.now().isoformat(),
                    "dustbins": [
                        {
                            "id": b.id,
                            "location": b.location,
                            "status": b.status,
                            "fill_level": b.fill_level,
                            "battery": b.battery,
                            "lat": b.lat,
                            "lng": b.lng,
                            "qr_code": b.qr_code,
                            "last_updated": b.last_updated.isoformat() if b.last_updated else None
                        } for b in bins
                    ],
                    "stats": {
                        "total": len(bins),
                        "overflowing": len([b for b in bins if b.status == "overflowing"]),
                        "full": len([b for b in bins if b.status == "full"]),
                        "half_full": len([b for b in bins if b.status == "half-full"]),
                        "empty": len([b for b in bins if b.status == "empty"])
                    }
                }
            finally:
                db.close()

            await manager.broadcast(data)
            await asyncio.sleep(5)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)


async def notify_bin_update(bin_data: dict):
    """Called by IoT routes when a bin is updated — push instant update to all clients."""
    await manager.broadcast({
        "type": "single_bin_update",
        "bin": bin_data,
        "timestamp": datetime.now().isoformat()
    })
