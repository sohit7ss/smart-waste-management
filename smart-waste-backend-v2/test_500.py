from database import SessionLocal
from models import Dustbin
from schemas import DustbinResponse

db = SessionLocal()
dustbins = db.query(Dustbin).all()
has_error = False

for d in dustbins:
    try:
        # For Pydantic v1 vs v2
        if hasattr(DustbinResponse, 'model_validate'):
            DustbinResponse.model_validate(d)
        else:
            DustbinResponse.from_orm(d)
    except Exception as e:
        has_error = True
        print(f"Validation error on dustbin {d.id}:")
        print(e)
        break

if not has_error:
    print("No validation errors found!")
