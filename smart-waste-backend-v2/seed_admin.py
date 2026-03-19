from database import SessionLocal
import models
from utils.security import get_password_hash

def seed_admin():
    db = SessionLocal()
    admin_email = "admin@smartwaste.city.in"
    admin_password = "admin123"
    
    # Check if user already exists
    existing_user = db.query(models.User).filter(models.User.email == admin_email).first()
    
    if existing_user:
        print(f"User {admin_email} already exists. Updating password to 'admin123'.")
        existing_user.password_hash = get_password_hash(admin_password)
    else:
        print(f"Creating new admin user: {admin_email}")
        new_admin = models.User(
            name="System Admin",
            email=admin_email,
            password_hash=get_password_hash(admin_password),
            role="admin"
        )
        db.add(new_admin)
    
    db.commit()
    db.close()
    print("Admin seeding completed successfully.")

if __name__ == "__main__":
    seed_admin()
