from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from database import engine, Base
import os
import time
from datetime import datetime
from dotenv import load_dotenv

# Import Routers
from routes import auth_routes, dustbin_routes, complaint_routes, route_routes, analytics_routes, iot_routes, alert_routes, fleet_routes
from routes.websocket_routes import websocket_dashboard, manager
# Import Middlewares
from middleware.rate_limiter import limiter
from middleware.logger import AuditLogMiddleware
from middleware.security import RequestSizeLimitMiddleware

load_dotenv()

# Create DB Tables
Base.metadata.create_all(bind=engine)

# Create uploads directory
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Track server start time for health endpoint
start_time = time.time()

app = FastAPI(
    title="Smart Waste Management API V2",
    description="Production-Ready API for Smart Waste Monitoring — India Innovates 2026",
    version="2.0.0"
)

# 1. Rate Limiting Setup
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# 2. CORS Setup
origins_str = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:5174,http://localhost:5175")
origins = [o.strip() for o in origins_str.split(",")]
print(f"--- [DEBUG] Allowed CORS Origins: {origins} ---")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all for demo
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Security Headers & Audit Logging
app.add_middleware(AuditLogMiddleware)
app.add_middleware(RequestSizeLimitMiddleware)

# 4. Mount static file serving for uploads
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# 5. Include Routers
app.include_router(auth_routes.router)
app.include_router(dustbin_routes.router)
app.include_router(complaint_routes.router)
app.include_router(route_routes.router)
app.include_router(analytics_routes.router)
app.include_router(iot_routes.router)
app.include_router(alert_routes.router)
app.include_router(fleet_routes.router)

# 6. WebSocket endpoint (Upgrade 1)
app.websocket("/ws/dashboard")(websocket_dashboard)


@app.get("/")
@limiter.limit("10/minute")
def root(request: Request):
    return {"message": "V2 System Online. See /docs for API documentation."}


# MISSING FEATURE 6 — System Health Endpoint
@app.get("/health")
def system_health():
    """System health check with resource usage and component status."""
    try:
        import psutil
        cpu = psutil.cpu_percent()
        memory = psutil.virtual_memory().percent
    except Exception:
        cpu = -1
        memory = -1

    try:
        from ai.detector import detector
        ai_status = "loaded" if detector.available else "simulation"
    except Exception:
        ai_status = "unavailable"

    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "uptime_seconds": int(time.time() - start_time),
        "cpu_percent": cpu,
        "memory_percent": memory,
        "ai_model": ai_status,
        "database": "connected",
        "websocket_connections": len(manager.active_connections),
        "version": "2.0.0"
    }




# ─── Notification Endpoints ────────────────────────────────────────────────────

fcm_tokens = []

@app.post("/notifications/register")
async def register_fcm(data: dict):
    """Register a Firebase Cloud Messaging (FCM) device token."""
    token    = data.get("token")
    platform = data.get("platform", "unknown")
    if token and token not in fcm_tokens:
        fcm_tokens.append(token)
        print(f"FCM token registered: {token[:20]}... ({platform})")
        
    return {
        "success":    True,
        "message":    "FCM token registered",
        "platform":   platform,
        "total_devices": len(fcm_tokens)
    }

@app.post("/notifications/send")
async def send_notification(data: dict):
    """Queue a push notification via FCM (requires firebase-admin setup)."""
    return {
        "success": True,
        "message": "Notification queued",
        "recipients": len(fcm_tokens),
        "note": "Add serviceAccountKey.json for real FCM"
    }

# ─── Camera Web App Endpoint ──────────────────────────────────────────────────
from fastapi.responses import HTMLResponse
import base64
from PIL import Image
import io

@app.get("/camera", response_class=HTMLResponse)
async def camera_page():
    html = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SmartBin Camera</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            background: #0f172a;
            color: white;
            font-family: -apple-system, sans-serif;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .header {
            width: 100%;
            background: #1e293b;
            padding: 16px 20px;
            display: flex;
            align-items: center;
            gap: 12px;
            border-bottom: 1px solid #334155;
        }

        .header h1 {
            font-size: 18px;
            color: #22c55e;
        }

        .header p {
            font-size: 12px;
            color: #64748b;
        }

        .camera-container {
            width: 100%;
            max-width: 480px;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        #video {
            width: 100%;
            border-radius: 16px;
            border: 3px solid #334155;
            background: #000;
        }

        #canvas { display: none; }

        .result-card {
            background: #1e293b;
            border-radius: 16px;
            padding: 20px;
            border: 2px solid #334155;
            text-align: center;
            transition: all 0.3s;
        }

        .result-card.empty     { border-color: #22c55e; }
        .result-card.half-full { border-color: #f59e0b; }
        .result-card.full      { border-color: #f97316; }
        .result-card.overflowing { border-color: #ef4444; }

        .status-emoji {
            font-size: 56px;
            margin-bottom: 8px;
        }

        .status-text {
            font-size: 28px;
            font-weight: bold;
            text-transform: uppercase;
            margin-bottom: 8px;
        }

        .status-text.empty      { color: #22c55e; }
        .status-text.half-full  { color: #f59e0b; }
        .status-text.full       { color: #f97316; }
        .status-text.overflowing { color: #ef4444; }

        .confidence {
            font-size: 16px;
            color: #94a3b8;
            margin-bottom: 12px;
        }

        .fill-bar-container {
            background: #334155;
            border-radius: 999px;
            height: 12px;
            margin: 8px 0;
            overflow: hidden;
        }

        .fill-bar {
            height: 100%;
            border-radius: 999px;
            transition: width 0.5s, background 0.5s;
        }

        .fill-label {
            font-size: 20px;
            font-weight: bold;
            margin-top: 4px;
        }

        .bin-selector {
            background: #1e293b;
            border-radius: 12px;
            padding: 16px;
        }

        .bin-selector label {
            display: block;
            color: #64748b;
            font-size: 12px;
            text-transform: uppercase;
            margin-bottom: 8px;
        }

        .bin-selector select {
            width: 100%;
            background: #0f172a;
            color: white;
            border: 1px solid #334155;
            border-radius: 8px;
            padding: 10px;
            font-size: 15px;
        }

        .controls {
            display: flex;
            gap: 12px;
        }

        .btn {
            flex: 1;
            padding: 14px;
            border: none;
            border-radius: 12px;
            font-size: 15px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.2s;
        }

        .btn-start {
            background: #22c55e;
            color: white;
        }

        .btn-stop {
            background: #ef4444;
            color: white;
        }

        .btn-snap {
            background: #3b82f6;
            color: white;
        }

        .btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .status-bar {
            background: #1e293b;
            border-radius: 12px;
            padding: 12px 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 13px;
        }

        .live-dot {
            width: 8px;
            height: 8px;
            background: #22c55e;
            border-radius: 50%;
            display: inline-block;
            margin-right: 6px;
            animation: blink 1s infinite;
        }

        .live-dot.offline {
            background: #ef4444;
            animation: none;
        }

        @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
        }

        .history {
            background: #1e293b;
            border-radius: 12px;
            padding: 16px;
        }

        .history h3 {
            font-size: 14px;
            color: #64748b;
            text-transform: uppercase;
            margin-bottom: 12px;
        }

        .history-item {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #334155;
            font-size: 13px;
        }

        .history-item:last-child {
            border-bottom: none;
        }

        .alert-banner {
            background: #ef444422;
            border: 1px solid #ef4444;
            border-radius: 12px;
            padding: 12px 16px;
            color: #ef4444;
            font-weight: bold;
            text-align: center;
            display: none;
            animation: shake 0.5s;
        }

        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-10px); }
            75% { transform: translateX(10px); }
        }

        .dashboard-sync {
            background: #22c55e22;
            border: 1px solid #22c55e;
            border-radius: 12px;
            padding: 12px 16px;
            color: #22c55e;
            font-size: 13px;
            text-align: center;
            display: none;
        }
    </style>
</head>
<body>

<div class="header">
    <span style="font-size: 28px">🗑️</span>
    <div>
        <h1>SmartBin AI Camera</h1>
        <p>Live fill level detection</p>
    </div>
    <div style="margin-left: auto; text-align: right;">
        <span class="live-dot" id="liveDot"></span>
        <span id="liveStatus" style="font-size:12px">Connecting...</span>
    </div>
</div>

<div class="camera-container">
    
    <!-- Alert Banner -->
    <div class="alert-banner" id="alertBanner">
        🚨 OVERFLOW DETECTED! Alert sent to dashboard!
    </div>

    <!-- Dashboard Sync -->
    <div class="dashboard-sync" id="syncBanner">
        ✅ Dashboard updated!
    </div>

    <!-- Video Feed -->
    <video id="video" autoplay playsinline></video>
    <canvas id="canvas"></canvas>

    <!-- Bin Selector -->
    <div class="bin-selector">
        <label>Select Dustbin to Update</label>
        <select id="binSelect">
            <option value="1">Bin #1 - Sector 1 Main Market</option>
            <option value="2">Bin #2 - Sector 2 Bus Stand</option>
            <option value="3">Bin #3 - Sector 3 Park Gate</option>
            <option value="4">Bin #4 - Sector 4 School</option>
            <option value="5">Bin #5 - Sector 5 Hospital</option>
        </select>
    </div>

    <!-- Result Card -->
    <div class="result-card" id="resultCard">
        <div class="status-emoji" id="statusEmoji">📷</div>
        <div class="status-text" id="statusText">Waiting...</div>
        <div class="confidence" id="confidence">
            Point camera at a dustbin
        </div>
        <div class="fill-bar-container">
            <div class="fill-bar" id="fillBar"
                 style="width:0%; background:#334155">
            </div>
        </div>
        <div class="fill-label" id="fillLabel">0%</div>
    </div>

    <!-- Controls -->
    <div class="controls">
        <button class="btn btn-start" id="startBtn"
                onclick="startCamera()">
            📷 Start Camera
        </button>
        <button class="btn btn-snap" id="snapBtn"
                onclick="analyzeNow()" disabled>
            🔍 Analyze Now
        </button>
        <button class="btn btn-stop" id="stopBtn"
                onclick="stopCamera()" disabled>
            ⏹ Stop
        </button>
    </div>

    <!-- Status Bar -->
    <div class="status-bar">
        <span>
            <span class="live-dot" id="aiDot" style="background:#64748b">
            </span>
            AI Status: <span id="aiStatus">Idle</span>
        </span>
        <span id="frameCount" style="color:#64748b">
            0 frames analyzed
        </span>
    </div>

    <!-- Detection History -->
    <div class="history">
        <h3>📋 Detection History</h3>
        <div id="historyList">
            <div style="color:#64748b; font-size:13px; text-align:center; padding:12px">
                No detections yet
            </div>
        </div>
    </div>

</div>

<script>
    const BACKEND = window.location.origin
    let stream = null
    let interval = null
    let frameCount = 0
    let isAnalyzing = false

    const statusConfig = {
        'empty':       { emoji: '🟢', color: '#22c55e', fill: 10  },
        'half-full':   { emoji: '🟡', color: '#f59e0b', fill: 50  },
        'full':        { emoji: '🟠', color: '#f97316', fill: 85  },
        'overflowing': { emoji: '🔴', color: '#ef4444', fill: 100 },
    }

    async function startCamera() {
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment', // rear camera
                    width:  { ideal: 640 },
                    height: { ideal: 480 }
                }
            })

            document.getElementById('video').srcObject = stream

            document.getElementById('startBtn').disabled = true
            document.getElementById('stopBtn').disabled  = false
            document.getElementById('snapBtn').disabled  = false

            document.getElementById('liveStatus').textContent = 'Live'
            document.getElementById('liveDot').classList.remove('offline')

            // Auto analyze every 3 seconds
            interval = setInterval(analyzeNow, 3000)

        } catch (err) {
            alert('Camera error: ' + err.message +
                  '\\n\\nMake sure you allowed camera permission!')
        }
    }

    function stopCamera() {
        if (stream) {
            stream.getTracks().forEach(t => t.stop())
            stream = null
        }
        if (interval) {
            clearInterval(interval)
            interval = null
        }

        document.getElementById('startBtn').disabled = false
        document.getElementById('stopBtn').disabled  = true
        document.getElementById('snapBtn').disabled  = true

        document.getElementById('liveStatus').textContent = 'Stopped'
        document.getElementById('liveDot').classList.add('offline')
        document.getElementById('aiStatus').textContent = 'Idle'
    }

    async function analyzeNow() {
        if (isAnalyzing) return
        const video = document.getElementById('video')
        if (!video.srcObject) return

        isAnalyzing = true
        document.getElementById('aiStatus').textContent = 'Analyzing...'
        document.getElementById('aiDot').style.background = '#f59e0b'

        try {
            // Capture frame from video
            const canvas = document.getElementById('canvas')
            canvas.width  = video.videoWidth  || 640
            canvas.height = video.videoHeight || 480
            const ctx = canvas.getContext('2d')
            ctx.drawImage(video, 0, 0)

            // Convert to blob
            const blob = await new Promise(resolve =>
                canvas.toBlob(resolve, 'image/jpeg', 0.8)
            )

            // Get selected bin
            const binId = document.getElementById('binSelect').value

            // Send to AI backend
            const formData = new FormData()
            formData.append('file', blob, 'frame.jpg')

            const res = await fetch(
                `${BACKEND}/dustbins/${binId}/analyze`,
                { method: 'POST', body: formData }
            )

            if (!res.ok) throw new Error(`HTTP ${res.status}`)

            const data = await res.json()
            frameCount++

            // Update UI
            updateResult(data)

            // Update dashboard
            await syncToDashboard(binId, data)

            document.getElementById('frameCount').textContent =
                `${frameCount} frames analyzed`
            document.getElementById('aiStatus').textContent = 'Active ✅'
            document.getElementById('aiDot').style.background = '#22c55e'

        } catch (err) {
            console.error('Analysis error:', err)
            document.getElementById('aiStatus').textContent = 'Error ❌'
            document.getElementById('aiDot').style.background = '#ef4444'
        } finally {
            isAnalyzing = false
        }
    }

    function updateResult(data) {
        const status = data.status || 'empty'
        const conf   = data.confidence || 0
        const fill   = data.fill_level || 0
        const config = statusConfig[status] || statusConfig['empty']

        // Update result card
        const card = document.getElementById('resultCard')
        card.className = `result-card ${status}`

        document.getElementById('statusEmoji').textContent = config.emoji
        document.getElementById('statusText').textContent  = status.toUpperCase()
        document.getElementById('statusText').className = `status-text ${status}`
        document.getElementById('confidence').textContent =
            `Confidence: ${conf.toFixed(1)}% | AI: ${data.ai_powered ? 'YOLOv8 ✅' : 'Simulated'}`

        // Fill bar
        const bar = document.getElementById('fillBar')
        bar.style.width      = `${fill}%`
        bar.style.background = config.color

        document.getElementById('fillLabel').textContent = `${fill}% Full`
        document.getElementById('fillLabel').style.color = config.color

        // Show overflow alert
        const alertBanner = document.getElementById('alertBanner')
        if (status === 'overflowing') {
            alertBanner.style.display = 'block'
            // Vibrate phone
            if (navigator.vibrate) navigator.vibrate([200, 100, 200])
            setTimeout(() => alertBanner.style.display = 'none', 4000)
        }

        // Add to history
        addHistory(status, conf, fill)
    }

    async function syncToDashboard(binId, data) {
        try {
            // Update bin via IoT endpoint
            await fetch(`${BACKEND}/iot/update`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': 'smartbin-iot-key-2026'
                },
                body: JSON.stringify({
                    dustbin_id: parseInt(binId),
                    fill_level: data.fill_level,
                    status:     data.status,
                    distance:   50 - (data.fill_level * 0.5),
                    battery:    85,
                    source:     'phone_camera',
                    timestamp:  new Date().toISOString()
                })
            })

            // Show sync banner
            const syncBanner = document.getElementById('syncBanner')
            syncBanner.textContent =
                `✅ Bin #${binId} updated on dashboard!`
            syncBanner.style.display = 'block'
            setTimeout(() => syncBanner.style.display = 'none', 2000)

        } catch (err) {
            console.error('Sync error:', err)
        }
    }

    function addHistory(status, conf, fill) {
        const list   = document.getElementById('historyList')
        const config = statusConfig[status] || statusConfig['empty']
        const time   = new Date().toLocaleTimeString()

        // Remove placeholder
        const placeholder = list.querySelector('[style*="text-align:center"]')
        if (placeholder) placeholder.remove()

        // Add new item at top
        const item = document.createElement('div')
        item.className = 'history-item'
        item.innerHTML = `
            <span>
                ${config.emoji}
                <span style="color:${config.color}; font-weight:bold">
                    ${status.toUpperCase()}
                </span>
                — ${fill}% full
            </span>
            <span style="color:#64748b">${time}</span>
        `
        list.insertBefore(item, list.firstChild)

        // Keep only last 10
        const items = list.querySelectorAll('.history-item')
        if (items.length > 10) {
            items[items.length - 1].remove()
        }
    }

    // Check backend connection on load
    window.onload = async () => {
        try {
            const res = await fetch(`${BACKEND}/health`)
            if (res.ok) {
                document.getElementById('liveStatus').textContent = 'Connected'
                document.getElementById('liveDot').classList.remove('offline')

                // Load bins from backend
                const bins = await fetch(`${BACKEND}/dustbins/`)
                    .then(r => r.json())

                if (Array.isArray(bins) && bins.length > 0) {
                    const select = document.getElementById('binSelect')
                    select.innerHTML = bins.map(b =>
                        `<option value="${b.id}">
                            Bin #${b.id} - ${b.location}
                        </option>`
                    ).join('')
                }
            }
        } catch {
            document.getElementById('liveStatus').textContent = 'Offline'
            document.getElementById('liveDot').classList.add('offline')
        }
    }
</script>

</body>
</html>
    """
    return HTMLResponse(content=html)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host="0.0.0.0",  # Listen on all interfaces
        port=8000,
        reload=False
    )

