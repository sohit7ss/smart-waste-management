from database import SessionLocal, engine
import models
from datetime import datetime, timedelta

# Create tables
models.Base.metadata.create_all(bind=engine)
db = SessionLocal()

def seed_demo_data():
    # 5 bins across Delhi
    bins = [
        {"location": "Connaught Place, Delhi", 
         "lat": 28.6315, "lng": 77.2167,
         "status": "overflowing", "fill_level": 100, "battery": 85},
        {"location": "India Gate, Delhi", 
         "lat": 28.6129, "lng": 77.2295,
         "status": "full", "fill_level": 82, "battery": 72},
        {"location": "Chandni Chowk, Delhi", 
         "lat": 28.6506, "lng": 77.2334,
         "status": "half-full", "fill_level": 45, "battery": 90},
        {"location": "Sarojini Nagar, Delhi", 
         "lat": 28.5745, "lng": 77.1993,
         "status": "overflowing", "fill_level": 100, "battery": 65},
        {"location": "Lajpat Nagar, Delhi", 
         "lat": 28.5677, "lng": 77.2360,
         "status": "empty", "fill_level": 10, "battery": 95},
    ]

    for b in bins:
        db.add(models.Dustbin(**b))

    # 3 demo complaints with Delhi coordinates
    complaints = [
        {"location": "Connaught Place, Delhi",
         "lat": 28.6315, "lng": 77.2167,
         "description": "Bin overflowing near metro station",
         "status": "pending", "priority": "high", "user_id": 1},
        {"location": "India Gate, Delhi", 
         "lat": 28.6129, "lng": 77.2295,
         "description": "Garbage scattered on footpath",
         "status": "assigned", "priority": "normal", "user_id": 1},
        {"location": "Chandni Chowk, Delhi",
         "lat": 28.6506, "lng": 77.2334,
         "description": "Broken bin lid needs replacement",
         "status": "resolved", "priority": "normal", "user_id": 1,
         "timestamp": datetime.utcnow() - timedelta(hours=4),
         "resolved_at": datetime.utcnow() - timedelta(hours=0.5)},
    ]

    for c in complaints:
        db.add(models.Complaint(**c))

    db.commit()
    print("Seeded Delhi demo data successfully!")
    db.close()

if __name__ == "__main__":
    seed_demo_data()
