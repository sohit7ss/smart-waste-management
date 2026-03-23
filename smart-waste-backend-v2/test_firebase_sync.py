import firebase_admin
from firebase_admin import credentials, firestore
from database import SessionLocal
import models
import traceback
from datetime import datetime

cred = credentials.Certificate('serviceAccountKey.json')
firebase_admin.initialize_app(cred)

db = SessionLocal()
firebase_db = firestore.client()

reports_ref = firebase_db.collection('reports')
reports = reports_ref.stream()

for doc in reports:
    data = doc.to_dict()
    firestore_id = doc.id
    print(f"\n--- Processing {firestore_id} ---")
    
    existing = db.query(models.Complaint).filter(
        models.Complaint.firestore_id == firestore_id
    ).first()
    
    if existing:
        print(f"Already exists in DB: Complaint ID {existing.id}")
        continue
        
    print("Not in SQLite. Attempting to insert...")
    print(f"Data: {data}")
    
    location_obj = data.get('location') or {}
    if isinstance(location_obj, dict):
        lat = float(location_obj.get('latitude') or 30.9010)
        lng = float(location_obj.get('longitude') or 75.8573)
    else:
        lat = 30.9010
        lng = 75.8573
        
    priority_raw = str(data.get('priority') or 'Medium')
    status_raw = str(data.get('status') or 'Pending')
    
    firebase_uid = str(data.get('userId') or '')
    user = None
    if firebase_uid:
        user = db.query(models.User).filter(models.User.firebase_uid == firebase_uid).first()
    if not user:
        email = f"{firebase_uid or firestore_id}@citizen.app"
        user = db.query(models.User).filter(models.User.email == email).first()
        if not user:
            user = models.User(
                name=data.get('userName') or 'Citizen',
                email=email,
                password_hash='firebase_user',
                role='citizen',
                firebase_uid=firebase_uid or None
            )
            db.add(user)
            db.flush()
            
    try:
        complaint = models.Complaint(
            user_id=user.id,
            firestore_id=firestore_id,
            location=str(data.get('address') or 'Unknown Location'),
            lat=lat,
            lng=lng,
            description=str(data.get('description') or ''),
            image_url=str(data.get('imageUrl') or '') or None,
            status=status_raw.lower(),
            priority=priority_raw.lower(),
        )
        db.add(complaint)
        db.commit()
        print("✅ INSERT SUCCESS!")
    except Exception as e:
        db.rollback()
        print("❌ INSERT FAILED")
        traceback.print_exc()

db.close()
