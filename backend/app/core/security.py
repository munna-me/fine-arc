"""
Password hashing + JWT helpers for Fine Arc auth.

SECRET_KEY should be set via the JWT_SECRET_KEY environment variable
(e.g. in backend/.env). A dev-only fallback is used if it's missing so the
app doesn't crash on first run, but tokens signed with the fallback are not
safe for anything beyond local development.
"""
import datetime
import os
import secrets

import bcrypt
import jwt

SECRET_KEY = os.environ.get("JWT_SECRET_KEY")
if not SECRET_KEY:
    SECRET_KEY = "dev-only-insecure-secret-change-me"
    print(
        "[finearc] WARNING: JWT_SECRET_KEY is not set. Using an insecure dev "
        "fallback — set JWT_SECRET_KEY in backend/.env before deploying."
    )

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days — no refresh-token flow for now


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(subject: str) -> str:
    expire = datetime.datetime.utcnow() + datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> str:
    """Returns the subject (user email) encoded in the token, or raises jwt.PyJWTError."""
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    return payload["sub"]


VERIFICATION_CODE_TTL_MINUTES = 15


def generate_verification_code() -> str:
    """6-digit numeric code, e.g. '042817'."""
    return f"{secrets.randbelow(1_000_000):06d}"


def verification_code_expiry() -> datetime.datetime:
    return datetime.datetime.utcnow() + datetime.timedelta(minutes=VERIFICATION_CODE_TTL_MINUTES)