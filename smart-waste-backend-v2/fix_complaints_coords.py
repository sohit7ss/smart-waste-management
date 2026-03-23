import sqlite3
import random

DB_PATH = 'waste_management.db'
conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# Add lat/lng columns if missing
try:
    cursor.execute("ALTER TABLE complaints ADD COLUMN lat REAL")
    print("Added lat column")
except:
    print("lat column already exists")

try:
    cursor.execute("ALTER TABLE complaints ADD COLUMN lng REAL")
    print("Added lng column")
except:
    print("lng column already exists")

# Update existing complaints with Delhi coordinates
complaints = cursor.execute(
    "SELECT id, location FROM complaints WHERE lat IS NULL"
).fetchall()

delhi_locations = [
    (28.6139, 77.2090),
    (28.6200, 77.2150),
    (28.6080, 77.2200),
    (28.6250, 77.2050),
    (28.6180, 77.2250),
]

for complaint_id, location in complaints:
    lat, lng = random.choice(delhi_locations)
    lat += random.uniform(-0.005, 0.005)
    lng += random.uniform(-0.005, 0.005)
    
    cursor.execute(
        "UPDATE complaints SET lat=?, lng=? WHERE id=?",
        (lat, lng, complaint_id)
    )
    print(f"Fixed complaint #{complaint_id}: ({lat:.4f}, {lng:.4f})")

conn.commit()
conn.close()
print("All complaints updated!")
