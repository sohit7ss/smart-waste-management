from ultralytics import YOLO
import os

# Load waste type classification model
_waste_model = None

def get_waste_model():
    global _waste_model
    if _waste_model is None:
        model_path = "waste_type_best.pt"
        if os.path.exists(model_path):
            _waste_model = YOLO(model_path)
            print("✅ Waste classification model loaded")
        else:
            print("⚠️ waste_type_best.pt not found - using simulation")
    return _waste_model

def classify_waste_type(image_path: str) -> dict:
    """
    Classify waste type from image.
    Returns category, confidence, and all probabilities.
    """
    model = get_waste_model()
    
    # Simulation fallback if model not available
    if model is None:
        import random
        categories = ['organic', 'recyclable', 'hazardous', 'dry']
        weights = [0.4, 0.35, 0.1, 0.15]
        category = random.choices(categories, weights=weights)[0]
        confidence = round(random.uniform(85, 95), 1)
        return {
            "category": category,
            "confidence": confidence,
            "simulated": True,
            "all_probabilities": {c: round(random.uniform(0,1), 3) 
                                  for c in categories}
        }
    
    try:
        results = model.predict(image_path, verbose=False)
        probs = results[0].probs
        top_class_idx = probs.top1
        confidence = round(float(probs.top1conf) * 100, 1)
        category = model.names[top_class_idx]
        
        # Map model class names to standard names if needed
        category_map = {
            'organic': 'organic',
            'biological': 'organic',
            'recyclable': 'recyclable',
            'cardboard': 'recyclable',
            'glass': 'recyclable',
            'metal': 'recyclable',
            'paper': 'recyclable',
            'plastic': 'recyclable',
            'hazardous': 'hazardous',
            'battery': 'hazardous',
            'dry': 'dry',
            'clothes': 'dry',
            'shoes': 'dry',
            'trash': 'dry',
        }
        mapped_category = category_map.get(category.lower(), category)
        
        # Circular economy info per category
        circular_economy = {
            'organic': {
                'action': 'Composting → Fertilizer → Agriculture',
                'bin_color': 'Green',
                'icon': '🌿',
                'co2_saved': '2.5 kg CO₂/kg'
            },
            'recyclable': {
                'action': 'Material Recovery → Factory → New Product',
                'bin_color': 'Blue',
                'icon': '♻️',
                'co2_saved': '1.8 kg CO₂/kg'
            },
            'hazardous': {
                'action': 'Safe Disposal → Certified Facility',
                'bin_color': 'Red',
                'icon': '⚠️',
                'co2_saved': 'Prevents 12 kg CO₂eq leakage'
            },
            'dry': {
                'action': 'Upcycling → Artisans/NGOs → New Products',
                'bin_color': 'Yellow',
                'icon': '🧺',
                'co2_saved': '0.9 kg CO₂/kg'
            }
        }
        
        all_probs = {}
        for i, prob in enumerate(probs.data):
            class_name = model.names[i]
            mapped = category_map.get(class_name.lower(), class_name)
            all_probs[mapped] = round(float(prob), 3)
        
        return {
            "category": mapped_category,
            "confidence": confidence,
            "simulated": False,
            "circular_economy": circular_economy.get(mapped_category, {}),
            "all_probabilities": all_probs,
            "disposal_tip": get_disposal_tip(mapped_category)
        }
        
    except Exception as e:
        print(f"❌ Waste classification error: {e}")
        return {
            "category": "unknown",
            "confidence": 0,
            "error": str(e),
            "simulated": True
        }

def get_disposal_tip(category: str) -> str:
    tips = {
        'organic': 'Keep moist. Avoid meat and dairy. Ideal for home composting.',
        'recyclable': 'Rinse containers before disposal. Remove caps and lids.',
        'hazardous': 'Never mix with regular waste. Use designated drop-off points.',
        'dry': 'Donate wearable clothes. Keep dry and away from wet waste.'
    }
    return tips.get(category, 'Dispose responsibly.')
