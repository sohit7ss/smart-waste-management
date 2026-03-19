import RPi.GPIO as GPIO
import requests
import time
import picamera
import io
import base64
from datetime import datetime

SERVER_URL  = "http://YOUR_SERVER_IP:8000"
API_KEY     = "smartbin-iot-key-2026"
DUSTBIN_ID  = 1
BIN_DEPTH   = 50  # cm

# GPIO Setup
TRIG = 23
ECHO = 24
GPIO.setmode(GPIO.BCM)
GPIO.setup(TRIG, GPIO.OUT)
GPIO.setup(ECHO, GPIO.IN)

headers = {
    "X-API-Key":    API_KEY,
    "Content-Type": "application/json"
}

def read_distance():
    GPIO.output(TRIG, False)
    time.sleep(0.1)
    GPIO.output(TRIG, True)
    time.sleep(0.00001)
    GPIO.output(TRIG, False)
    
    while GPIO.input(ECHO) == 0:
        pulse_start = time.time()
    while GPIO.input(ECHO) == 1:
        pulse_end = time.time()
    
    pulse_duration = pulse_end - pulse_start
    distance = pulse_duration * 17150
    return round(distance, 2)

def get_status(fill):
    if fill >= 90: return "overflowing"
    if fill >= 60: return "full"
    if fill >= 30: return "half-full"
    return "empty"

def capture_image():
    camera = picamera.PiCamera()
    stream = io.BytesIO()
    camera.capture(stream, format="jpeg")
    stream.seek(0)
    image_base64 = base64.b64encode(stream.read()).decode("utf-8")
    camera.close()
    return image_base64

print("Raspberry Pi SmartBin Starting...")

try:
    while True:
        distance   = read_distance()
        fill_level = max(0, min(100, ((BIN_DEPTH - distance) / BIN_DEPTH) * 100))
        status     = get_status(fill_level)
        
        print(f"Distance: {distance}cm | Fill: {fill_level:.1f}% | Status: {status}")
        
        # Send sensor data
        data = {
            "dustbin_id": DUSTBIN_ID,
            "fill_level": round(fill_level, 1),
            "status":     status,
            "distance":   distance,
            "battery":    100,
            "timestamp":  datetime.now().isoformat()
        }
        
        try:
            requests.post(f"{SERVER_URL}/iot/update", json=data, headers=headers)
        except Exception as e:
            print(f"Error sending data: {e}")
        
        # Send image every 5 minutes (simplified logic for demo)
        if int(time.time()) % 300 < 30: # Check every 30s period
            try:
                image = capture_image()
                img_data = {"dustbin_id": DUSTBIN_ID, "image": image}
                requests.post(f"{SERVER_URL}/iot/image", json=img_data, headers=headers)
                print("Image sent for AI analysis!")
            except Exception as e:
                print(f"Error sending image: {e}")
        
        time.sleep(30)

except KeyboardInterrupt:
    GPIO.cleanup()
    print("Stopped!")
