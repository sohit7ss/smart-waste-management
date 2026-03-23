import sqlite3

DB_PATH = 'waste_management.db'
conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# Fix all bin coordinates to real Delhi landmarks
bins = [
    (1, 28.6508, 77.2373, 'Connaught Place'),
    (2, 28.6129, 77.2295, 'India Gate Area'),
    (3, 28.6562, 77.2410, 'Karol Bagh Market'),
    (4, 28.6304, 77.2177, 'Rajiv Chowk'),
    (5, 28.6448, 77.2167, 'Patel Nagar'),
]

for bin_id, lat, lng, location in bins:
    cursor.execute("""
        UPDATE dustbins 
        SET lat=?, lng=?, location=?
        WHERE id=?
    """, (lat, lng, location, bin_id))
    print(f"Fixed Bin {bin_id}: {location} ({lat}, {lng})")

conn.commit()
conn.close()
print("All coordinates fixed!")
