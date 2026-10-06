"""
Database connection and session handling for PostgreSQL.
Only tables allowed in V1:
- files
- matching_jobs
- matching_configs
- result_files
(No users or auth tables)
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://matchengine:matchengine_secret@localhost:5432/matchengine_db")

engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_size=20, max_overflow=40)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
