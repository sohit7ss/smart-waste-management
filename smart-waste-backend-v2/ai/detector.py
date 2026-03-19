from PIL import Image
import io
import os

class WasteDetector:
    def __init__(self):
        self.model = None
        self.available = False
        self.load_model()
    
    def load_model(self):
        model_paths = [
            'best.pt',
            'ai/best.pt',
            os.path.join(os.path.dirname(__file__), 'best.pt'),
            r'C:\Users\Sohit_Narayan\ultralytics\runs\detect\dustbin_model\weights\best.pt'
        ]
        for path in model_paths:
            if os.path.exists(path):
                try:
                    from ultralytics import YOLO
                    self.model = YOLO(path)
                    self.available = True
                    print(f"✅ AI Model loaded from: {path}")
                    return
                except Exception as e:
                    print(f"⚠️ Failed to load from {path}: {e}")
        print("⚠️ AI Model not found - using simulation mode")
    
    def analyze(self, image_bytes: bytes) -> dict:
        image = Image.open(io.BytesIO(image_bytes))
        
        if not self.available:
            # Simulation mode for demo
            import random
            statuses = ["empty", "half-full", "full", "overflowing"]
            weights = [0.2, 0.3, 0.3, 0.2]
            status = random.choices(statuses, weights=weights)[0]
            fill_map = {"empty": 5, "half-full": 50, "full": 85, "overflowing": 100}
            return {
                "status": status,
                "fill_level": fill_map[status],
                "confidence": round(random.uniform(75, 95), 1),
                "all_detections": [],
                "ai_powered": False,
                "mode": "simulation"
            }
        
        results = self.model(image)
        status = "empty"
        confidence = 0.0
        all_detections = []
        
        for result in results:
            for box in result.boxes:
                class_id = int(box.cls)
                conf = float(box.conf)
                class_name = result.names[class_id]
                all_detections.append({
                    "class": class_name,
                    "confidence": round(conf * 100, 1)
                })
                if conf > confidence:
                    confidence = conf
                    status = class_name
        
        fill_map = {
            "empty": 5,
            "half-full": 50,
            "full": 85,
            "overflowing": 100
        }
        
        return {
            "status": status,
            "fill_level": fill_map.get(status, 50),
            "confidence": round(confidence * 100, 1),
            "all_detections": all_detections,
            "ai_powered": True,
            "mode": "yolov8"
        }


# Global instance
detector = WasteDetector()
