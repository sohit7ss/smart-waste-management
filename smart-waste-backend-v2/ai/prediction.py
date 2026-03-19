import numpy as np
from datetime import datetime, timedelta


def predict_waste_levels(historical_data: list):
    """Predict future fill levels using linear regression on historical data."""
    if len(historical_data) < 3:
        return None
    
    x = np.array(range(len(historical_data)))
    y = np.array(historical_data)
    
    # Calculate trend via least-squares linear regression
    x_mean = np.mean(x)
    y_mean = np.mean(y)
    
    numerator = np.sum((x - x_mean) * (y - y_mean))
    denominator = np.sum((x - x_mean) ** 2)
    
    slope = numerator / denominator if denominator != 0 else 0
    intercept = y_mean - slope * x_mean
    
    # Predict next 7 days
    predictions = []
    for i in range(7):
        future_x = len(historical_data) + i
        predicted = slope * future_x + intercept
        predicted = max(0, min(100, predicted))  # Clamp to 0-100
        
        date = (datetime.now() + timedelta(days=i + 1)).strftime("%Y-%m-%d")
        predictions.append({
            "date": date,
            "predicted_fill_level": round(predicted, 1),
            "will_overflow": predicted >= 90,
            "collection_needed": predicted >= 75
        })
    
    return {
        "predictions": predictions,
        "trend": "increasing" if slope > 0 else "decreasing" if slope < 0 else "stable",
        "daily_increase_rate": round(slope, 2),
        "overflow_risk_bins": [p["date"] for p in predictions if p["will_overflow"]]
    }
