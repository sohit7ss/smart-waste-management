import sqlite3
import os
import sys

DB_PATH = os.path.join(
  os.path.dirname(__file__),
  'waste_management.db'
)

def reset_for_demo():
  print("=" * 50)
  print("   SMART WASTE DEMO RESET TOOL")
  print("=" * 50)
  
  if not os.path.exists(DB_PATH):
    print(f"Database not found at: {DB_PATH}")
    return
  
  conn   = sqlite3.connect(DB_PATH)
  cursor = conn.cursor()
  
  # Clear complaints
  cursor.execute("DELETE FROM complaints")
  print("[OK] Complaints cleared")
  
  # Clear alerts
  try:
    cursor.execute("DELETE FROM alerts")
    print("[OK] Alerts cleared")
  except:
    pass
  
  # Reset dustbins to perfect demo state
  demo_bins = [
    (1, 15.0,  'empty',       85.0),
    (2, 45.0,  'half-full',   72.0),
    (3, 10.0,  'empty',       91.0),
    (4, 95.0,  'overflowing', 68.0),
    (5, 55.0,  'half-full',   79.0),
  ]
  
  for bin_id, fill, status, battery in demo_bins:
    cursor.execute("""
      UPDATE dustbins
      SET fill_level=?, status=?, battery=?
      WHERE id=?
    """, (fill, status, battery, bin_id))
  
  print("[OK] Dustbin levels reset")
  
  conn.commit()
  conn.close()
  
  print("\n" + "=" * 50)
  print("   DEMO IS READY! ")
  print("=" * 50)
  print("\nBin Status:")
  print("  Bin 1: 15%  - [EMPTY]")
  print("  Bin 2: 45%  - [HALF FULL]")
  print("  Bin 3: 10%  - [EMPTY]")
  print("  Bin 4: 95%  - [OVERFLOWING]")
  print("  Bin 5: 55%  - [HALF FULL]")
  print("\nLogin: admin@smartwaste.city.in / admin123")
  print("Dashboard: http://localhost:5173")
  print("Citizen:   http://localhost:5174")
  print("API Docs:  http://localhost:8000/docs")

if __name__ == "__main__":
  reset_for_demo()
