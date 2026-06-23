from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone
from typing import Optional

from config import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    JWT_ALGORITHM as ALGORITHM,
    REFRESH_TOKEN_EXPIRE_DAYS,
    SECRET_KEY,
)

# Cấu hình password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Cấu hình JWT


def hash_password(password: str) -> str:
    """Hash password sử dụng bcrypt"""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Kiểm tra password có khớp với hash không"""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Tạo access token JWT"""
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": int(expire.timestamp()), "type": "access"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    
    return encoded_jwt


def create_refresh_token(data: dict) -> tuple[str, datetime]:
    """
    Tạo refresh token JWT
    Returns: (token, expires_at)
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    
    to_encode.update({"exp": int(expire.timestamp()), "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    
    return encoded_jwt, expire


def decode_token(token: str) -> Optional[dict]:
    """
    Giải mã token JWT (skip expiration check - handle manually)
    Returns: Token payload hoặc None nếu token không hợp lệ
    """
    try:
        payload = jwt.decode(
            token, 
            SECRET_KEY, 
            algorithms=[ALGORITHM],
            options={"verify_exp": False}  # Skip auto expiration check
        )
        return payload
    except JWTError:
        return None


def verify_token_type(token: str, expected_type: str) -> bool:
    """Kiểm tra loại token (access hoặc refresh)"""
    payload = decode_token(token)
    if not payload:
        return False
    return payload.get("type") == expected_type


def is_token_expired(token: str) -> bool:
    """
    Kiểm tra token đã hết hạn chưa
    Returns: True nếu token đã hết hạn, False nếu còn hạn
    """
    payload = decode_token(token)
    if not payload:
        return True  # Invalid token = expired
    
    exp_timestamp = payload.get("exp")
    if not exp_timestamp:
        return True  # No exp claim = invalid
    
    current_time = datetime.now(timezone.utc)
    exp_datetime = datetime.fromtimestamp(exp_timestamp, tz=timezone.utc)
    
    return current_time > exp_datetime
