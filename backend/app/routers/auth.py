import os

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.db.database import get_db
from app.db.models import User
from app.schemas.auth import GoogleAuthRequest, Token, UserCreate, UserLogin, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    email = payload.email.lower()
    existing = db.query(User).filter(User.email == email).first()

    if existing and existing.is_verified:
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

    if existing and not existing.is_verified:
        # Leftover from before verification was required — just activate it.
        existing.hashed_password = hash_password(payload.password)
        existing.is_verified = True
        user = existing
    else:
        user = User(
            email=email,
            hashed_password=hash_password(payload.password),
            auth_provider="local",
            is_verified=True,
        )
        db.add(user)

    db.commit()
    db.refresh(user)

    token = create_access_token(subject=user.email)
    return Token(access_token=token, user=UserOut.model_validate(user))


@router.post("/login", response_model=Token)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    email = payload.email.lower()
    user = db.query(User).filter(User.email == email).first()

    if not user or not user.hashed_password:
        if user and user.auth_provider == "google":
            raise HTTPException(status_code=401, detail="This account uses Google sign-in. Use the Google button instead.")
        raise HTTPException(status_code=401, detail="Incorrect email or password.")

    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")

    token = create_access_token(subject=user.email)
    return Token(access_token=token, user=UserOut.model_validate(user))


@router.post("/google", response_model=Token)
def google_login(payload: GoogleAuthRequest, db: Session = Depends(get_db)):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google sign-in is not configured on the server.")

    from google.auth import exceptions as google_exceptions
    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token as google_id_token

    try:
        idinfo = google_id_token.verify_oauth2_token(
            payload.credential, google_requests.Request(), GOOGLE_CLIENT_ID
        )
    except (ValueError, google_exceptions.GoogleAuthError):
        raise HTTPException(status_code=401, detail="Invalid Google credential.")

    if not idinfo.get("email_verified", False):
        raise HTTPException(status_code=401, detail="Google account email is not verified.")

    email = idinfo["email"].lower()
    google_sub = idinfo["sub"]

    user = db.query(User).filter(User.google_sub == google_sub).first()
    if not user:
        user = db.query(User).filter(User.email == email).first()
        if user:
            user.google_sub = google_sub
            user.is_verified = True
        else:
            user = User(
                email=email,
                hashed_password=None,
                auth_provider="google",
                google_sub=google_sub,
                is_verified=True,
            )
            db.add(user)

    db.commit()
    db.refresh(user)

    token = create_access_token(subject=user.email)
    return Token(access_token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def read_current_user(current_user: User = Depends(get_current_user)):
    return current_user