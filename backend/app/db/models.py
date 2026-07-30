import datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, String

from app.db.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)

    # Nullable because Google-only accounts have no local password.
    hashed_password = Column(String, nullable=True)

    auth_provider = Column(String, default="local", nullable=False)  # "local" | "google"
    google_sub = Column(String, unique=True, nullable=True, index=True)

    is_verified = Column(Boolean, default=False, nullable=False)
    verification_code = Column(String, nullable=True)
    verification_code_expires = Column(DateTime, nullable=True)

    solve_count = Column(Integer, default=0, nullable=False)

    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)