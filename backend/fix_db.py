from app.core.db import engine
from sqlalchemy import text
with engine.begin() as conn:
    try:
        conn.execute(text("ALTER TABLE users ADD COLUMN password_hash VARCHAR(255);"))
    except Exception as e:
        print(e)
    try:
        conn.execute(text("ALTER TABLE users ADD COLUMN fcm_token VARCHAR(255);"))
    except Exception as e:
        print(e)
    try:
        conn.execute(text("ALTER TABLE users ALTER COLUMN telegram_id DROP NOT NULL;"))
    except Exception as e:
        print(e)
print("DB fixed")
