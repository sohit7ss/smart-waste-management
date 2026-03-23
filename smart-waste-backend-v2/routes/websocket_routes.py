from fastapi import WebSocket, WebSocketDisconnect
from typing import List
from datetime import datetime
import asyncio
import json
import queue

from database import SessionLocal
import models

# Thread-safe queue for messages coming from background sync threads
broadcast_queue = queue.Queue()

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"✅ Dashboard connected. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        print(f"❌ Dashboard disconnected. Total: {len(self.active_connections)}")

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

manager = ConnectionManager()


async def process_broadcast_queue():
    """Continuously checks the thread-safe queue for messages from background threads."""
    while True:
        while not broadcast_queue.empty():
            msg_str = broadcast_queue.get()
            try:
                msg_dict = json.loads(msg_str)
                await manager.broadcast(msg_dict)
            except Exception as e:
                print(f"Queue broadcast error: {e}")
        await asyncio.sleep(0.5) # Poll every 500ms


async def websocket_dashboard(websocket: WebSocket):
    """
    WebSocket endpoint for live dashboard updates.
    The Dashboard.jsx now expects purely event-driven updates.
    """
    await manager.connect(websocket)
    
    # Start the queue processor if it hasn't been started
    # (FastAPI lifespan is better, but this works for demonstration)
    task = asyncio.create_task(process_broadcast_queue())
    
    try:
        while True:
            # We just keep the connection open.
            # All updates are now pushed directly via manager.broadcast()
            # rather than heavy interval polling.
            data = await websocket.receive_text()
            # We could handle incoming pings here if needed
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        task.cancel()
    except Exception:
        manager.disconnect(websocket)
        task.cancel()


# Helper functions for async context (API routes)
async def notify_bin_update(bin_data: dict):
    await manager.broadcast({
        "type": "bin_update",
        "bin": bin_data
    })

async def notify_new_alert(alert_data: dict):
    await manager.broadcast({
        "type": "new_alert",
        "alert": alert_data
    })

async def notify_complaint_update(complaint_data: dict):
    await manager.broadcast({
        "type": "complaint_update",
        "complaint": complaint_data
    })

async def notify_truck_update(truck_data: dict):
    await manager.broadcast({
        "type": "truck_update",
        "truck": truck_data
    })
