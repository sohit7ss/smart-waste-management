from database import SessionLocal
import models

db = SessionLocal()

# Cleanup just in case
db.query(models.Alert).delete()
db.query(models.Dustbin).delete()
db.commit()

# Create 5 bins
for i in range(1, 6):
    bin = models.Dustbin(
        id=i,
        location=f"Area {i}",
        lat=12.9716 + (i * 0.01),
        lng=77.5946 + (i * 0.01),
        status="empty",
        fill_level=0,
        battery=100.0,
        qr_code=f"BIN-{i:03d}"
    )
    db.add(bin)

db.commit()
print("SUCCESS: 5 test dustbins created.")
db.close()
