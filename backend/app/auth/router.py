from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.auth import schemas, service
from app.database.session import get_db
from app.security.jwt_handler import get_current_user, CurrentUser

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(payload: schemas.RegisterRequest, db: Session = Depends(get_db)):
    user = service.register_user(db, payload.email, payload.password, payload.full_name)
    return {"id": user.id, "email": user.email, "message": "Registered. Check email for verification OTP."}


@router.post("/verify-email")
def verify_email(payload: schemas.OTPVerifyRequest, db: Session = Depends(get_db)):
    service.verify_otp(db, payload.email, payload.code, purpose="email_verification")
    return {"message": "Email verified"}


@router.post("/login", response_model=schemas.TokenPair)
def login(payload: schemas.LoginRequest, request: Request, db: Session = Depends(get_db)):
    access, refresh = service.authenticate_and_issue_tokens(
        db, payload.email, payload.password, payload.device_info,
        ip_address=request.client.host if request.client else None,
    )
    return schemas.TokenPair(access_token=access, refresh_token=refresh)


@router.post("/refresh", response_model=schemas.TokenPair)
def refresh(payload: schemas.RefreshRequest, db: Session = Depends(get_db)):
    access, refresh_token = service.rotate_refresh_token(db, payload.refresh_token)
    return schemas.TokenPair(access_token=access, refresh_token=refresh_token)


@router.post("/logout")
def logout(payload: schemas.LogoutRequest, request: Request, db: Session = Depends(get_db)):
    service.logout(db, payload.refresh_token, ip_address=request.client.host if request.client else None)
    return {"message": "Logged out"}


@router.post("/logout-all")
def logout_all(request: Request, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    service.logout_all_devices(db, current_user.id, ip_address=request.client.host if request.client else None)
    return {"message": "Logged out of all devices"}


@router.post("/forgot-password")
def forgot_password(payload: schemas.ForgotPasswordRequest, db: Session = Depends(get_db)):
    service.forgot_password(db, payload.email)
    return {"message": "If that email exists, a reset code has been sent"}


@router.post("/reset-password")
def reset_password(payload: schemas.ResetPasswordRequest, db: Session = Depends(get_db)):
    service.reset_password(db, payload.email, payload.code, payload.new_password)
    return {"message": "Password reset. All sessions have been logged out."}
