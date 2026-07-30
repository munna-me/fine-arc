from datetime import datetime

from pydantic import BaseModel, EmailStr, field_validator


class UserCreate(BaseModel):
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def password_must_be_reasonable(cls, value: str) -> str:
        if len(value) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        return value


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    created_at: datetime
    auth_provider: str
    solve_count: int

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class RegisterResponse(BaseModel):
    message: str
    email: str


class VerifyEmailRequest(BaseModel):
    email: EmailStr
    code: str


class ResendCodeRequest(BaseModel):
    email: EmailStr


class GoogleAuthRequest(BaseModel):
    credential: str  # the ID token returned by Google Identity Services