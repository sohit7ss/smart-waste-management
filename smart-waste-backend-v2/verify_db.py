from database import engine
from sqlalchemy import inspect

inspector = inspect(engine)
columns = inspector.get_columns('dustbins')
column_names = [c['name'] for c in columns]

if 'battery' in column_names:
    print("SUCCESS: 'battery' column found in 'dustbins' table.")
else:
    print("FAILURE: 'battery' column NOT found in 'dustbins' table. You may need to delete the .db file to let it recreate.")
