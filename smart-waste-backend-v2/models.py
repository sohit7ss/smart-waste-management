from sqlalchemy import Boolean, Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)
    role = Column(String, default="citizen") # admin, driver, citizen, supervisor
    firebase_uid = Column(String, nullable=True, unique=True)
    fcm_token = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    complaints = relationship("Complaint", back_populates="user")

class Dustbin(Base):
    __tablename__ = "dustbins"
    id = Column(Integer, primary_key=True, index=True)
    location = Column(String, index=True)
    lat = Column(Float)
    lng = Column(Float)
    status = Column(String, default="empty") # empty, half-full, full, overflowing
    fill_level = Column(Float, default=0.0)
    battery = Column(Float, default=100.0)
    last_updated = Column(DateTime, default=datetime.utcnow)
    qr_code = Column(String, unique=True, index=True)
    
    alerts = relationship("Alert", back_populates="dustbin")

class Complaint(Base):
    __tablename__ = "complaints"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True) # Nullable for guest citizen reports
    location = Column(String)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    description = Column(String)
    image_url = Column(String, nullable=True)
    firestore_id = Column(String, nullable=True, unique=True)
    status = Column(String, default="pending") # pending, assigned, resolved
    priority = Column(String, default="normal") # normal, high
    timestamp = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
    
    waste_category = Column(String, nullable=True) # organic/recyclable/hazardous/dry
    waste_confidence = Column(Float, nullable=True) # 0-100
    waste_scanned = Column(Boolean, default=False)
    
    user = relationship("User", back_populates="complaints")

class Route(Base):
    __tablename__ = "routes"
    id = Column(Integer, primary_key=True, index=True)
    van_id = Column(String, index=True)
    stops = Column(String) # JSON string of stop IDs
    coordinates = Column(String) # JSON string [[lat,lng],...]
    estimated_time = Column(Integer) # in minutes
    total_distance = Column(Float, default=0.0)
    fuel_saved = Column(Float) # percentage
    co2_saved = Column(Float, default=0.0)
    status = Column(String, default="pending") # pending, in_progress, completed
    date = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

class Alert(Base):
    __tablename__ = "alerts"
    id = Column(Integer, primary_key=True, index=True)
    dustbin_id = Column(Integer, ForeignKey("dustbins.id"))
    type = Column(String) # overflow, anomaly
    message = Column(String)
    resolved = Column(Boolean, default=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    dustbin = relationship("Dustbin", back_populates="alerts")

class WasteReport(Base):
    __tablename__ = "waste_reports"
    id = Column(Integer, primary_key=True, index=True)
    date = Column(DateTime, default=datetime.utcnow)
    area = Column(String)
    total_waste = Column(Float) # in kg or tons
    waste_type = Column(String) # mixed, dry, wet
    trend = Column(String) # increasing, decreasing, stable
