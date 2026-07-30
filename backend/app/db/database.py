"""
Database setup for Fine Arc.

Uses a local SQLite file by default (backend/finearc.db) so there's nothing
extra to install or run. Set DATABASE_URL in backend/.env to point at
Postgres/MySQL/etc. later without touching any other code.
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # .../backend/app
BACKEND_DIR = os.path.dirname(APP_DIR)                                  # .../backend
DEFAULT_SQLITE_PATH = os.path.join(BACKEND_DIR, "finearc.db")

DATABASE_URL = os.environ.get("DATABASE_URL", f"sqlite:///{DEFAULT_SQLITE_PATH}")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency that yields a DB session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
