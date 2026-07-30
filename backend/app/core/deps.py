from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
import jwt

from app.core.security import decode_access_token
from app.db.database import get_db
from app.db.models import User

# auto_error=False so we can raise our own consistent 401 (with a clear
# message) instead of FastAPI's generic "Not authenticated" for a missing header.
bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if credentials is None:
        raise unauthorized

    try:
        email = decode_access_token(credentials.credentials)
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired, please log in again.",
        )
    except jwt.PyJWTError:
        raise unauthorized

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise unauthorized

    return user


def get_optional_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """
    Like get_current_user, but never raises — returns None for guests
    (missing/invalid/expired token) instead of a 401. Used on endpoints that
    should work for both logged-in users and guests.
    """
    if credentials is None:
        return None
    try:
        email = decode_access_token(credentials.credentials)
    except jwt.PyJWTError:
        return None
    return db.query(User).filter(User.email == email).first()