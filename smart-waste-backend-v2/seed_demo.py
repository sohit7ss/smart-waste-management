from database import SessionLocal
import models
from utils.security import get_password_hash

def seed_demo():
    """Seed the database with demo-ready data."""
    db = SessionLocal()
    
    # --- Ensure admin user exists ---
    admin_email = "admin@smartwaste.city.in"
    admin_password = "admin123"
    existing = db.query(models.User).filter(models.User.email == admin_email).first()
    if existing:
        existing.password_hash = get_password_hash(admin_password)
        print(f"[OK] Admin user updated: {admin_email}")
    else:
        admin = models.User(
            name="System Admin",
            email=admin_email,
            password_hash=get_password_hash(admin_password),
            role="admin"
        )
        db.add(admin)
        print(f"[OK] Admin user created: {admin_email}")
    
    # --- Ensure driver user exists ---
    driver_email = "driver@smartwaste.city.in"
    driver_password = "driver123"
    existing_driver = db.query(models.User).filter(models.User.email == driver_email).first()
    if not existing_driver:
        driver = models.User(
            name="Demo Driver",
            email=driver_email,
            password_hash=get_password_hash(driver_password),
            role="driver"
        )
        db.add(driver)
        print(f"[OK] Driver user created: {driver_email}")
    else:
        print(f"[INFO] Driver user already exists: {driver_email}")
    
    # --- Seed dustbins if empty ---
    bin_count = db.query(models.Dustbin).count()
    if bin_count == 0:
        demo_bins = [
            models.Dustbin(id=1, location="Sector 1 - Main Market",  lat=28.6139, lng=77.2090, status="overflowing", fill_level=95, battery=85.0, qr_code="BIN-001"),
            models.Dustbin(id=2, location="Sector 2 - Bus Stand",    lat=28.6229, lng=77.2190, status="full",        fill_level=82, battery=72.0, qr_code="BIN-002"),
            models.Dustbin(id=3, location="Sector 3 - Park Gate",    lat=28.6319, lng=77.2290, status="half-full",   fill_level=45, battery=90.0, qr_code="BIN-003"),
            models.Dustbin(id=4, location="Sector 4 - School",       lat=28.6409, lng=77.2390, status="overflowing", fill_level=100, battery=65.0, qr_code="BIN-004"),
            models.Dustbin(id=5, location="Sector 5 - Hospital",     lat=28.6499, lng=77.2490, status="empty",       fill_level=10, battery=95.0, qr_code="BIN-005"),
        ]
        for b in demo_bins:
            db.add(b)
        print("[OK] 5 demo dustbins created")
    else:
        print(f"[INFO] {bin_count} dustbins already exist, skipping")
    
    db.commit()
    db.close()
    
    print("")
    print("=== DEMO READY ===")
    print(f"Admin Dashboard: http://localhost:5173")
    print(f"Citizen Portal:  http://localhost:5174")
    print(f"Driver View:     http://localhost:5173/driver")
    print(f"API Docs:        http://localhost:8000/docs")
    print(f"")
    print(f"Admin Login:  admin@smartwaste.city.in / admin123")
    print(f"Driver Login: driver@smartwaste.city.in / driver123")

if __name__ == "__main__":
    seed_demo()
