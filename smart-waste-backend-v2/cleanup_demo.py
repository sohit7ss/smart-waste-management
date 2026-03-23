from database import SessionLocal
from models import Complaint

db = SessionLocal()
bad_words = ['fuck', 'fhhbb', 'test123', 'asdf', 'fhbb', 
             'hi', 'hello', 'ok', 'lol']
complaints = db.query(Complaint).all()
deleted = 0
fixed = 0

for c in complaints:
    if c.description:
        if any(word in c.description.lower() for word in bad_words):
            db.delete(c)
            deleted += 1
    else:
        c.description = 'Waste overflow reported by citizen'
        fixed += 1

db.commit()
print(f"Deleted {deleted} bad complaints, fixed {fixed} empty ones")
db.close()
