import threading
import time
import json
from datetime import datetime, timezone
from firebase_admin import firestore as firebase_firestore
from sqlalchemy.orm import Session
from models import Complaint, User
from database import SessionLocal

# Track last sync time
last_sync_time = None

def get_firebase_db():
    return firebase_firestore.client()

def auto_classify_complaint_image(complaint_id: int, image_url: str):
    """
    Download complaint image from Firebase Storage URL
    and classify waste type using waste_type_best.pt
    """
    if not image_url:
        return
    
    db: Session = SessionLocal()
    try:
        import requests
        import uuid
        import os
        from ai.waste_classifier import classify_waste_type
        
        # Download image from Firebase URL
        temp_path = f"/tmp/complaint_{uuid.uuid4()}.jpg"
        
        try:
            response = requests.get(image_url, timeout=10)
            if response.status_code == 200:
                with open(temp_path, 'wb') as f:
                    f.write(response.content)
            else:
                print(f"⚠️ Could not download image: {response.status_code}")
                return
        except Exception as e:
            print(f"⚠️ Image download failed: {e}")
            return
        
        # Run AI classification
        result = classify_waste_type(temp_path)
        
        # Update complaint with result
        complaint = db.query(Complaint).filter(
            Complaint.id == complaint_id
        ).first()
        
        if complaint and result:
            complaint.waste_category = result.get('category', 'unknown')
            complaint.waste_confidence = result.get('confidence', 0)
            complaint.waste_scanned = True
            db.commit()
            
            print(f"🤖 Complaint #{complaint_id} classified: "
                  f"{result.get('category')} "
                  f"({result.get('confidence')}%)")
            
            # Broadcast update to dashboard
            _broadcast_complaint_classification(
                complaint_id,
                result.get('category'),
                result.get('confidence')
            )
        
        # Cleanup temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)
            
    except Exception as e:
        print(f"❌ Auto classification error: {e}")
        db.rollback()
    finally:
        db.close()


def _broadcast_complaint_classification(
    complaint_id: int, 
    category: str, 
    confidence: float
):
    """Broadcast waste classification result to dashboard"""
    try:
        import asyncio
        import json
        from routes.websocket_routes import manager
        
        message = json.dumps({
            "type": "complaint_classified",
            "complaint_id": complaint_id,
            "waste_category": category,
            "waste_confidence": confidence
        })
        
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.run_coroutine_threadsafe(
                    manager.broadcast(message), loop
                )
            else:
                loop.run_until_complete(
                    manager.broadcast(message)
                )
        except RuntimeError:
            loop = asyncio.new_event_loop()
            loop.run_until_complete(
                manager.broadcast(message)
            )
            loop.close()
            
    except Exception as e:
        print(f"⚠️ Classification broadcast failed: {e}")

def sync_reports_from_firestore():
    global last_sync_time
    db: Session = SessionLocal()
    firebase_db = get_firebase_db()
    synced = 0
    updated = 0

    try:
        # Get ALL reports (reliable approach)
        reports_ref = firebase_db.collection('reports')
        reports = reports_ref.stream()

        for doc in reports:
            data = doc.to_dict()
            if not data:
                continue
                
            firestore_id = doc.id

            # Extract nested location safely
            location_obj = data.get('location') or {}
            if isinstance(location_obj, dict):
                lat = float(location_obj.get('latitude') or 30.9010)
                lng = float(location_obj.get('longitude') or 75.8573)
            else:
                lat = 30.9010
                lng = 75.8573

            # Map priority safely
            priority_raw = str(data.get('priority') or 'Medium')
            priority_map = {
                'low': 'normal',
                'medium': 'normal',
                'high': 'high',
                'critical': 'high'
            }
            priority = priority_map.get(priority_raw.lower(), 'normal')

            # Map status safely
            status_raw = str(data.get('status') or 'Pending')
            status_map = {
                'pending': 'pending',
                'in progress': 'assigned',
                'assigned': 'assigned',
                'resolved': 'resolved'
            }
            status = status_map.get(status_raw.lower(), 'pending')
            
            # Map timestamp
            created_at = data.get('createdAt')
            if created_at:
                if hasattr(created_at, 'timestamp'):
                    timestamp = datetime.fromtimestamp(created_at.timestamp(), tz=timezone.utc).replace(tzinfo=None)
                else:
                    timestamp = created_at
            else:
                timestamp = datetime.utcnow()

            # Check if already exists
            print(f"🔍 Checking Firestore doc: {firestore_id}")
            existing = db.query(Complaint).filter(
                Complaint.firestore_id == firestore_id
            ).first()

            if not existing:
                # Find or create user
                firebase_uid = str(data.get('userId') or '')
                user = None
                
                if firebase_uid:
                    user = db.query(User).filter(
                        User.firebase_uid == firebase_uid
                    ).first()
                
                if not user:
                    email = f"{firebase_uid or firestore_id}@citizen.app"
                    user = db.query(User).filter(
                        User.email == email
                    ).first()
                    
                    if not user:
                        user = User(
                            name=data.get('userName') or 'Citizen',
                            email=email,
                            password_hash='firebase_user',
                            role='citizen',
                            firebase_uid=firebase_uid or None
                        )
                        db.add(user)
                        db.flush()  # get user.id without full commit

                # Create complaint
                complaint = Complaint(
                    user_id=user.id,
                    firestore_id=firestore_id,
                    location=str(data.get('address') or 'Unknown Location'),
                    lat=lat,
                    lng=lng,
                    description=str(data.get('description') or ''),
                    image_url=str(data.get('imageUrl') or '') or None,
                    status=status,
                    priority=priority,
                    timestamp=timestamp
                )
                db.add(complaint)
                
                try:
                    db.commit()
                    db.refresh(complaint)
                    synced += 1
                    print(f"✅ NEW complaint synced: {firestore_id[:8]}... | {str(data.get('address',''))[:40]}")
                    
                    # After complaint saved successfully
                    if complaint.image_url:
                        # Run in separate thread to not block sync
                        import threading
                        scan_thread = threading.Thread(
                            target=auto_classify_complaint_image,
                            args=(complaint.id, complaint.image_url),
                            daemon=True
                        )
                        scan_thread.start()
                        print(f"🔍 Started AI scan for complaint #{complaint.id}")
                    
                    # Broadcast to dashboard via WebSocket
                    _broadcast_new_complaint(complaint, data)
                    
                except Exception as e:
                    db.rollback()
                    print(f"❌ Failed to save complaint {firestore_id}: {e}")
                    import traceback
                    traceback.print_exc()

            else:
                # Update status if changed
                if existing.status != status:
                    old_status = existing.status
                    existing.status = status
                    try:
                        db.commit()
                        updated += 1
                        print(f"🔄 Status updated: {firestore_id[:8]} | {old_status} → {status}")
                        _broadcast_complaint_update(existing)
                    except Exception as e:
                        db.rollback()
                        print(f"❌ Failed to update status: {e}")

        last_sync_time = datetime.now(timezone.utc)
        if synced > 0 or updated > 0:
            print(f"🔥 Sync: {synced} new, {updated} updated")
        else:
            print(f"⏳ Sync: no changes ({datetime.now().strftime('%H:%M:%S')})")

    except Exception as e:
        print(f"❌ Firestore sync error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


def _broadcast_new_complaint(complaint, firestore_data):
    """Thread-safe WebSocket broadcast for new complaint"""
    try:
        import asyncio
        from routes.websocket_routes import manager
        
        message = json.dumps({
            "type": "new_complaint",
            "complaint": {
                "id": complaint.id,
                "firestore_id": complaint.firestore_id,
                "location": complaint.location,
                "lat": complaint.lat,
                "lng": complaint.lng,
                "description": complaint.description,
                "image_url": complaint.image_url,
                "status": complaint.status,
                "priority": complaint.priority,
                "source": "firebase",
                "waste_type": str(firestore_data.get('wasteType') or ''),
                "phone": str(firestore_data.get('phone') or ''),
            }
        })
        
        # Get or create event loop for thread
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.run_coroutine_threadsafe(
                    manager.broadcast(message), loop
                )
            else:
                loop.run_until_complete(manager.broadcast(message))
        except RuntimeError:
            loop = asyncio.new_event_loop()
            loop.run_until_complete(manager.broadcast(message))
            loop.close()
            
        print(f"📡 Broadcast: new_complaint {complaint.id}")
    except Exception as e:
        print(f"⚠️ Broadcast failed (non-critical): {e}")


def _broadcast_complaint_update(complaint):
    """Thread-safe WebSocket broadcast for status update"""
    try:
        import asyncio
        from routes.websocket_routes import manager
        
        message = json.dumps({
            "type": "complaint_update",
            "complaint": {
                "id": complaint.id,
                "firestore_id": complaint.firestore_id,
                "status": complaint.status,
                "lat": complaint.lat,
                "lng": complaint.lng,
                "location": complaint.location
            }
        })
        
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.run_coroutine_threadsafe(
                    manager.broadcast(message), loop
                )
            else:
                loop.run_until_complete(manager.broadcast(message))
        except RuntimeError:
            loop = asyncio.new_event_loop()
            loop.run_until_complete(manager.broadcast(message))
            loop.close()
    except Exception as e:
        print(f"⚠️ Update broadcast failed (non-critical): {e}")


def sync_status_back_to_firestore(firestore_id: str, new_status: str):
    """When admin resolves → update Firestore so citizen sees it"""
    try:
        firebase_db = get_firebase_db()
        status_map = {
            'pending': 'Pending',
            'assigned': 'In Progress',
            'resolved': 'Resolved'
        }
        firebase_status = status_map.get(new_status, 'Pending')
        firebase_db.collection('reports').document(firestore_id).update({
            'status': firebase_status,
            'updatedAt': firebase_firestore.SERVER_TIMESTAMP
        })
        print(f"✅ Firestore updated: {firestore_id[:8]} → {firebase_status}")
    except Exception as e:
        print(f"❌ Firestore update error: {e}")


def start_sync_worker():
    """Background thread syncing every 10 seconds"""
    def worker():
        print("🔄 Firestore sync worker started - every 10 seconds")
        # Initial sync immediately
        sync_reports_from_firestore()
        while True:
            time.sleep(10)
            sync_reports_from_firestore()
    
    thread = threading.Thread(target=worker, daemon=True)
    thread.start()
    print("✅ Sync worker running")
