from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

# USER SCHEMAS
class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: str = "citizen"

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    created_at: datetime
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None

class DustbinBase(BaseModel):
    location: str
    lat: float
    lng: float
    status: str = "empty"
    fill_level: float = 0.0
    battery: float = 100.0
    qr_code: Optional[str] = None

class DustbinCreate(DustbinBase):
    pass

class DustbinUpdate(BaseModel):
    status: Optional[str] = None
    fill_level: Optional[float] = None
    battery: Optional[float] = None
    last_updated: Optional[datetime] = None

class DustbinResponse(DustbinBase):
    id: int
    last_updated: datetime
    class Config:
        from_attributes = True

# COMPLAINT SCHEMAS
class ComplaintBase(BaseModel):
    location: str
    description: str
    priority: str = "normal"
    lat: Optional[float] = None
    lng: Optional[float] = None

class ComplaintCreate(ComplaintBase):
    image_url: Optional[str] = None

class ComplaintUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None

class ComplaintResponse(ComplaintBase):
    id: int
    user_id: Optional[int] = None
    image_url: Optional[str] = None
    status: str
    timestamp: datetime
    class Config:
        from_attributes = True

# ROUTE SCHEMAS
class RouteBase(BaseModel):
    van_id: str
    stops: str
    estimated_time: int
    fuel_saved: float

class RouteCreate(RouteBase):
    pass

class RouteResponse(RouteBase):
    id: int
    status: str
    date: datetime
    class Config:
        from_attributes = True

# ALERT SCHEMAS
class AlertBase(BaseModel):
    dustbin_id: int
    type: str
    message: str

class AlertCreate(AlertBase):
    pass

class AlertResponse(AlertBase):
    id: int
    resolved: bool
    timestamp: datetime
    class Config:
        from_attributes = True

class AnalyticsBase(BaseModel):
    total_bins: int
    critical_bins: int
    total_complaints: int
    fuel_saved_avg: float
