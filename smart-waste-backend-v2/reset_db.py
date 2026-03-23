"""Drop all tables and recreate with current model schema."""
from database import engine, Base
import models  # Ensures all models are registered

print("Dropping all tables...")
Base.metadata.drop_all(bind=engine)
print("Recreating all tables...")
Base.metadata.create_all(bind=engine)

from sqlalchemy import inspect
inspector = inspect(engine)
cols = [c['name'] for c in inspector.get_columns('routes')]
print(f"Routes table columns: {cols}")
print("Done!")
