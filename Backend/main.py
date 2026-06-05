from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timezone
from database import (
    get_db,
    engine,
    Base,
    ensure_document_ocr_columns,
    ensure_group_ui_columns,
    ensure_user_profile_columns,
    ensure_group_shared_items_table,
)
from models import User, RefreshToken, Group, GroupMember, GroupSharedItem, Document, Flashcard
from schemas import (
    UserCreate, UserLogin, PasswordVerifyRequest, ProfileUpdateRequest,
    SignUpResponse, SignInResponse, SignOutResponse,
    UserResponse, TokenResponse, RefreshTokenRequest, RefreshTokenResponse,
    ErrorResponse,
    DocumentCreate, DocumentResponse, DocumentListResponse, DocumentDetailResponse,
    DocumentCreateResponse, DocumentUpdateFavorite, BasicResponse,
    FlashcardCreate, FlashcardResponse, FlashcardCreateResponse,
    FlashcardListItem, FlashcardListResponse, FlashcardDetailResponse,
    FlashcardUpdateFavorite
)
from auth import (
    hash_password, verify_password, create_access_token, create_refresh_token,
    decode_token, verify_token_type, is_token_expired
)
from group_routes import router as group_router
from ocr_service import (
    initialize_layout_model,
    process_and_ocr_document,
    structured_results_to_text,
)
from summary_service import process_and_summarize
from flashcard_service import process_and_create_flashcards
from title_service import generate_document_title
from takeaway_service import generate_key_takeaways
import tempfile
import os
import logging
import re
import uuid
from pathlib import Path
from pydantic import BaseModel
from typing import Any, Dict, List, Optional

logger = logging.getLogger("study_helper.api")
if not logger.handlers:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )

# Tạo bảng nếu chưa tồn tại
Base.metadata.create_all(bind=engine)
ensure_document_ocr_columns()
ensure_group_ui_columns()
ensure_user_profile_columns()
ensure_group_shared_items_table()

app = FastAPI(
    title="Study Helper Auth API",
    description="API xác thực cho Study Helper App",
    version="1.0.0"
)

# Cấu hình CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Trong production, thay đổi thành domain cụ thể
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_ROOT = Path("uploads")
AVATAR_DIR = UPLOAD_ROOT / "avatars"
AVATAR_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_ROOT)), name="uploads")

EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
PASSWORD_PATTERN = re.compile(r"^(?=.*[A-Z])(?=.*\d).{6,}$")
ALLOWED_AVATAR_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_AVATAR_BYTES = 5 * 1024 * 1024


# ==========================================
# STARTUP EVENT - Load models trước khi nhận request
# ==========================================
@app.on_event("startup")
async def startup_event():
    """
    Khởi tạo các model khi backend start up
    """
    print("\n" + "="*70)
    print("  🚀 KHỞI ĐỘNG BACKEND")
    print("="*70)
    
    # Load Paddle OCR model
    initialize_layout_model()
    
    print("="*70)
    print("  ✅ BACKEND SẴN SÀNG")
    print("="*70 + "\n")


# Register group routes
app.include_router(group_router)


@app.get("/health")
def health_check():
    """Kiểm tra sức khỏe API"""
    return {
        "success": True,
        "message": "API is running",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@app.post("/api/auth/signup", response_model=SignUpResponse)
def sign_up(user_data: UserCreate, db: Session = Depends(get_db)):
    """
    Sign up - Tạo tài khoản mới
    
    Request body:
    {
        "username": "string (3-20 ký tự, chỉ chữ cái, số, _)",
        "email": "string (@gmail.com)",
        "password": "string (min 6, phải có uppercase + số)",
        "role": "string (teacher hoặc student)"
    }
    """
    try:
        # Kiểm tra username đã tồn tại
        existing_username = db.query(User).filter(User.username == user_data.username).first()
        if existing_username:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username đã tồn tại"
            )
        
        # Kiểm tra email đã tồn tại
        existing_email = db.query(User).filter(User.email == user_data.email).first()
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email đã được đăng ký"
            )
        
        # Tạo user mới
        hashed_password = hash_password(user_data.password)
        new_user = User(
            username=user_data.username,
            email=user_data.email,
            hashed_password=hashed_password,
            role=user_data.role
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        user_response = UserResponse.model_validate(new_user)
        
        return SignUpResponse(
            success=True,
            message="Đăng ký thành công",
            data=user_response
        )
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi server: {str(e)}"
        )


@app.post("/api/auth/signin", response_model=SignInResponse)
def sign_in(user_data: UserLogin, db: Session = Depends(get_db)):
    """
    Sign in - Đăng nhập
    
    Request body:
    {
        "email": "string",
        "password": "string"
    }
    
    Response data:
    {
        "user": {...},
        "tokens": {
            "access_token": "...",
            "refresh_token": "...",
            "token_type": "bearer"
        }
    }
    """
    try:
        # Tìm user theo email
        user = db.query(User).filter(User.email == user_data.email).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Email hoặc password không chính xác"
            )
        
        # Kiểm tra password
        if not verify_password(user_data.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Email hoặc password không chính xác"
            )
        
        # Tạo tokens
        access_token = create_access_token({"sub": str(user.id), "email": user.email})
        refresh_token, refresh_expires = create_refresh_token({"sub": str(user.id), "email": user.email})
        
        # Lưu refresh token vào database
        new_token = RefreshToken(
            user_id=user.id,
            token=refresh_token,
            expires_at=refresh_expires
        )
        db.add(new_token)
        db.commit()
        db.refresh(new_token)
        
        sync_user_content_counts(db, user)
        db.commit()
        db.refresh(user)
        user_response = UserResponse.model_validate(user)
        tokens = TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token
        )
        
        return SignInResponse(
            success=True,
            message="Đăng nhập thành công",
            data={
                "user": user_response.model_dump(),
                "tokens": tokens.model_dump()
            }
        )
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi server: {str(e)}"
        )


@app.post("/api/auth/refresh", response_model=RefreshTokenResponse)
def refresh_access_token(request: RefreshTokenRequest, db: Session = Depends(get_db)):
    """
    Refresh token - Cấp access token mới
    
    Request body:
    {
        "refresh_token": "string"
    }
    
    Response data:
    {
        "access_token": "...",
        "refresh_token": "...",
        "token_type": "bearer"
    }
    """
    try:
        # Kiểm tra refresh token có hợp lệ không
        token_type_ok = verify_token_type(request.refresh_token, "refresh")
        if not token_type_ok:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token không hợp lệ hoặc đã hết hạn"
            )
        
        # Kiểm tra token đã hết hạn chưa
        if is_token_expired(request.refresh_token):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token đã hết hạn"
            )
        
        # Lấy thông tin từ token
        payload = decode_token(request.refresh_token)
        if not payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token không hợp lệ"
            )
        
        user_id = payload.get("sub")
        email = payload.get("email")
        
        # Kiểm tra refresh token có tồn tại trong database không
        db_token = db.query(RefreshToken).filter(
            RefreshToken.token == request.refresh_token,
            RefreshToken.user_id == int(user_id),
            RefreshToken.is_revoked == 0
        ).first()
        
        if not db_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token không hợp lệ hoặc đã bị thu hồi"
            )
        
        # Tạo access token mới
        access_token = create_access_token({"sub": user_id, "email": email})
        
        tokens = TokenResponse(
            access_token=access_token,
            refresh_token=request.refresh_token
        )
        
        return RefreshTokenResponse(
            success=True,
            message="Làm mới token thành công",
            data=tokens.model_dump()
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi server: {str(e)}"
        )


@app.post("/api/auth/signout", response_model=SignOutResponse)
def sign_out(request: RefreshTokenRequest, db: Session = Depends(get_db)):
    """
    Sign out - Đăng xuất
    
    Request body:
    {
        "refresh_token": "string"
    }
    """
    try:
        # Kiểm tra refresh token hợp lệ
        if not verify_token_type(request.refresh_token, "refresh"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token không hợp lệ"
            )
        
        # Lấy thông tin từ token
        payload = decode_token(request.refresh_token)
        if not payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token không hợp lệ"
            )
        
        user_id = payload.get("sub")
        
        # Thu hồi refresh token (đánh dấu là revoked)
        db_token = db.query(RefreshToken).filter(
            RefreshToken.token == request.refresh_token,
            RefreshToken.user_id == int(user_id)
        ).first()
        
        if db_token:
            db_token.is_revoked = 1
            db.commit()
        
        return SignOutResponse(
            success=True,
            message="Đăng xuất thành công"
        )
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi server: {str(e)}"
        )


@app.get("/api/auth/me")
def get_current_user(access_token: str, db: Session = Depends(get_db)):
    """
    Lấy thông tin user hiện tại (cần access token)
    
    Query params:
    {
        "access_token": "string"
    }
    """
    try:
        # Kiểm tra access token
        if not verify_token_type(access_token, "access"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Access token không hợp lệ hoặc đã hết hạn"
            )
        
        # Kiểm tra token đã hết hạn chưa
        if is_token_expired(access_token):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Access token đã hết hạn"
            )
        
        payload = decode_token(access_token)
        if not payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Access token không hợp lệ"
            )
        
        user_id = payload.get("sub")
        user = db.query(User).filter(User.id == int(user_id)).first()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User không tồn tại"
            )
        
        sync_user_content_counts(db, user)
        db.commit()
        db.refresh(user)

        return {
            "success": True,
            "message": "Lấy thông tin user thành công",
            "data": UserResponse.model_validate(user).model_dump()
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi server: {str(e)}"
        )


@app.post("/api/auth/me/verify-password")
def verify_current_password(
    request: PasswordVerifyRequest,
    access_token: str,
    db: Session = Depends(get_db),
):
    """Verify current password before revealing password-change fields."""
    try:
        user = get_user_from_token(access_token, db)
        if not verify_password(request.current_password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect",
            )
        return {"success": True, "message": "Password verified"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Loi server: {str(e)}",
        )


@app.put("/api/auth/me/profile")
def update_current_user_profile(
    request: ProfileUpdateRequest,
    access_token: str,
    db: Session = Depends(get_db),
):
    """Update the signed-in user's username/email/password."""
    try:
        user = get_user_from_token(access_token, db)
        next_username = (request.username or user.username).strip()
        next_email = (request.email or user.email).strip().lower()
        email_changed = next_email != user.email.lower()
        password_changed = bool(request.new_password)

        if not next_username:
            raise HTTPException(status_code=400, detail="Username is required")
        if not EMAIL_PATTERN.match(next_email):
            raise HTTPException(status_code=400, detail="Invalid email format")

        username_owner = db.query(User).filter(
            User.username == next_username,
            User.id != user.id,
        ).first()
        if username_owner:
            raise HTTPException(status_code=409, detail="Username is already in use")

        if email_changed:
            email_owner = db.query(User).filter(
                User.email == next_email,
                User.id != user.id,
            ).first()
            if email_owner:
                raise HTTPException(status_code=409, detail="Email is already in use")

        if email_changed or password_changed:
            if not request.current_password:
                raise HTTPException(status_code=400, detail="Current password is required")
            if not verify_password(request.current_password, user.hashed_password):
                raise HTTPException(status_code=400, detail="Current password is incorrect")

        if password_changed:
            if not PASSWORD_PATTERN.match(request.new_password or ""):
                raise HTTPException(
                    status_code=400,
                    detail="New password must be 6+ chars with uppercase and number",
                )
            user.hashed_password = hash_password(request.new_password)

        user.username = next_username
        user.email = next_email
        user.updated_at = datetime.now(timezone.utc)
        sync_user_content_counts(db, user)
        db.commit()
        db.refresh(user)

        return {
            "success": True,
            "message": "Profile updated successfully",
            "data": UserResponse.model_validate(user).model_dump(),
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Loi server: {str(e)}",
        )


@app.post("/api/auth/me/avatar")
async def upload_current_user_avatar(
    request: Request,
    access_token: str,
    avatar: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload and persist avatar URL for the signed-in user."""
    try:
        user = get_user_from_token(access_token, db)
        if avatar.content_type not in ALLOWED_AVATAR_TYPES:
            raise HTTPException(
                status_code=400,
                detail="Avatar must be a jpg, png, or webp image",
            )

        content = await avatar.read()
        if len(content) > MAX_AVATAR_BYTES:
            raise HTTPException(status_code=400, detail="Avatar image must be 5MB or smaller")

        extension = Path(avatar.filename or "").suffix.lower()
        if extension not in {".jpg", ".jpeg", ".png", ".webp"}:
            extension = ".jpg"

        filename = f"user_{user.id}_{uuid.uuid4().hex}{extension}"
        file_path = AVATAR_DIR / filename
        file_path.write_bytes(content)

        avatar_path = f"/uploads/avatars/{filename}"
        user.avatar_url = str(request.base_url).rstrip("/") + avatar_path
        user.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(user)

        return {
            "success": True,
            "message": "Avatar updated successfully",
            "data": UserResponse.model_validate(user).model_dump(),
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Loi server: {str(e)}",
        )


# ==========================================
# SCHEMAS FOR OCR AND SUMMARY
# ==========================================
class SummaryRequest(BaseModel):
    """Request schema for summary API"""
    text_content: Optional[str] = None
    ocr_results: Optional[List[Dict[str, Any]]] = None
    llm_endpoint: str = "http://192.168.20.150:8000/v1/chat/completions"
    model_name: str = "Qwen2.5/Qwen2.5-7B-Instruct/"


class SummaryResponse(BaseModel):
    """Response schema for summary API"""
    success: bool
    message: str
    data: dict


class OCRResponse(BaseModel):
    """Response schema for OCR API"""
    success: bool
    message: str
    data: dict


class FlashcardProcessRequest(BaseModel):
    """Request schema for flashcard generation API"""
    ocr_results: List[Dict[str, Any]]
    llm_endpoint: str = "http://192.168.20.150:8000/v1/chat/completions"
    model_name: str = "Qwen2.5/Qwen2.5-7B-Instruct/"


class FlashcardProcessResponse(BaseModel):
    """Response schema for flashcard generation API"""
    success: bool
    message: str
    data: dict


class TakeawayProcessRequest(BaseModel):
    """Request schema for key takeaway generation API"""
    summary_data: Optional[Dict[str, Any]] = None
    text_content: Optional[str] = None
    ocr_results: Optional[List[Dict[str, Any]]] = None
    llm_endpoint: str = "http://192.168.20.150:8000/v1/chat/completions"
    model_name: str = "Qwen2.5/Qwen2.5-7B-Instruct/"


class TakeawayProcessResponse(BaseModel):
    """Response schema for key takeaway generation API"""
    success: bool
    message: str
    data: dict


class DocumentTitleRequest(BaseModel):
    """Request schema for document title generation."""
    summary_data: Dict[str, Any]
    llm_endpoint: str = "http://192.168.20.150:8000/v1/chat/completions"
    model_name: str = "Qwen2.5/Qwen2.5-7B-Instruct/"


class DocumentTitleResponse(BaseModel):
    """Response schema for document title generation."""
    success: bool
    message: str
    data: dict


# ==========================================
# OCR ENDPOINT
# ==========================================
@app.post("/api/ocr/process", response_model=OCRResponse)
async def process_ocr(
    file: UploadFile = File(...),
    center_tolerance: int = 50,
    ocr_url: str = "http://192.168.20.156:8088/v1/ocr",
    ocr_max_workers: int = 4,
    visualize: bool = False
):
    """
    Trích xuất OCR từ file PDF hoặc ảnh
    
    Parameters:
    - file: File PDF hoặc ảnh (PNG, JPG, JPEG)
    - center_tolerance: Ngưỡng gom nhóm layout (mặc định 50)
    - ocr_url: URL của Mistral OCR API
    
    Returns:
    {
        "success": true,
        "message": "Trích xuất OCR thành công",
        "data": {
            "extracted_text": "...",
            "file_name": "...",
            "processing_time": "...s"
        }
    }
    """
    try:
        # Kiểm tra loại file
        allowed_extensions = {'.pdf', '.png', '.jpg', '.jpeg'}
        file_ext = os.path.splitext(file.filename)[1].lower()
        
        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Loại file không hỗ trợ. Hỗ trợ: PDF, PNG, JPG, JPEG"
            )
        
        # Lưu file vào temp directory
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_file_path = tmp_file.name
        
        try:
            # Xử lý OCR
            start_time = datetime.now(timezone.utc)
            ocr_results = process_and_ocr_document(
                tmp_file_path, 
                center_tolerance=center_tolerance,
                ocr_url=ocr_url,
                ocr_max_workers=ocr_max_workers,
                visualize=visualize
            )
            extracted_text = structured_results_to_text(ocr_results)
            end_time = datetime.now(timezone.utc)
            
            processing_time = (end_time - start_time).total_seconds()
            
            return OCRResponse(
                success=True,
                message="Trích xuất OCR thành công",
                data={
                    "ocr_results": ocr_results,
                    "extracted_text": extracted_text,
                    "file_name": file.filename,
                    "processing_time": f"{processing_time:.2f}s",
                    "text_length": len(extracted_text),
                    "num_blocks": len(ocr_results)
                }
            )
        
        finally:
            # Xóa temp file
            if os.path.exists(tmp_file_path):
                os.remove(tmp_file_path)
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi xử lý OCR: {str(e)}"
        )


# ==========================================
# SUMMARY ENDPOINT
# ==========================================
@app.post("/api/summary/process", response_model=SummaryResponse)
async def process_summary(request: SummaryRequest):
    """
    Tóm tắt nội dung text được trích xuất từ OCR
    
    Request body:
    {
        "text_content": "Nội dung text cần tóm tắt",
        "llm_endpoint": "http://192.168.20.150:8000/v1/chat/completions" (optional),
        "model_name": "Qwen2.5/Qwen2.5-7B-Instruct/" (optional)
    }
    
    Returns:
    {
        "success": true,
        "message": "Tóm tắt nội dung thành công",
        "data": {
            "pages": {
                "page_1": "summary...",
                "page_2": "summary..."
            },
            "full_summary": "..."
        }
    }
    """
    try:
        has_text_content = bool(request.text_content and request.text_content.strip())
        has_ocr_results = request.ocr_results is not None and len(request.ocr_results) > 0

        if not has_text_content and not has_ocr_results:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Can truyen text_content hoac ocr_results"
            )
        
        # Thực hiện tóm tắt (gọi async function trực tiếp)
        start_time = datetime.now(timezone.utc)
        summary_result = await process_and_summarize(
            text_content=request.text_content,
            ocr_results=request.ocr_results,
            llm_endpoint=request.llm_endpoint,
            model_name=request.model_name
        )
        logger.info("[Summary module result] %s", summary_result)
        end_time = datetime.now(timezone.utc)
        
        processing_time = (end_time - start_time).total_seconds()
        
        return SummaryResponse(
            success=True,
            message="Tóm tắt nội dung thành công",
            data={
                **summary_result,
                "processing_time": f"{processing_time:.2f}s",
                "num_pages": len(summary_result.get("pages", {}))
            }
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi tóm tắt nội dung: {str(e)}"
        )

@app.post("/api/takeaways/process", response_model=TakeawayProcessResponse)
async def process_takeaways(request: TakeawayProcessRequest):
    """
    Tao key takeaways tu summary/OCR/text bang LLM.
    """
    try:
        has_summary = bool(request.summary_data)
        has_text_content = bool(request.text_content and request.text_content.strip())
        has_ocr_results = request.ocr_results is not None and len(request.ocr_results) > 0

        if not has_summary and not has_text_content and not has_ocr_results:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Can truyen summary_data, text_content hoac ocr_results"
            )

        start_time = datetime.now(timezone.utc)
        takeaways = await generate_key_takeaways(
            summary_data=request.summary_data,
            text_content=request.text_content,
            ocr_results=request.ocr_results,
            llm_endpoint=request.llm_endpoint,
            model_name=request.model_name,
        )
        end_time = datetime.now(timezone.utc)
        processing_time = (end_time - start_time).total_seconds()

        return TakeawayProcessResponse(
            success=True,
            message="Tao key takeaways thanh cong",
            data={
                "key_takeaways": takeaways,
                "processing_time": f"{processing_time:.2f}s",
                "total_takeaways": len(takeaways),
            },
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Loi khi tao key takeaways: {str(e)}"
        )


# ==========================================
# FLASHCARD ENDPOINTS
# ==========================================
@app.post("/api/flashcards/process", response_model=FlashcardProcessResponse)
async def process_flashcards(request: FlashcardProcessRequest):
    """
    Tao flashcard tu output OCR structured.
    """
    try:
        if not request.ocr_results:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Can truyen ocr_results"
            )

        start_time = datetime.now(timezone.utc)
        flashcard_result = await process_and_create_flashcards(
            request.ocr_results,
            llm_endpoint=request.llm_endpoint,
            model_name=request.model_name,
        )
        for raw_item in flashcard_result.get("raw_outputs", []):
            logger.info(
                "[Flashcard LLM raw output] page=%s group=%s box=%s\n%s",
                raw_item.get("page"),
                raw_item.get("group_idx"),
                raw_item.get("box_idx"),
                raw_item.get("raw_output", ""),
            )
        logger.info("[Flashcard module result] %s", flashcard_result)
        if int(flashcard_result.get("total_cards", 0)) <= 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    "LLM khong tao duoc flashcard hop le. "
                    "Vui long thu lai voi tai lieu ro hon hoac noi dung day du hon."
                ),
            )
        end_time = datetime.now(timezone.utc)
        processing_time = (end_time - start_time).total_seconds()

        return FlashcardProcessResponse(
            success=True,
            message="Tao flashcard thanh cong",
            data={
                **flashcard_result,
                "processing_time": f"{processing_time:.2f}s",
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Loi khi tao flashcard: {str(e)}"
        )


# ==========================================
# DOCUMENT ENDPOINTS
# ==========================================

def get_user_from_token(access_token: str, db: Session):
    """
    Helper function để lấy user từ access token
    """
    if not verify_token_type(access_token, "access"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Access token không hợp lệ hoặc đã hết hạn"
        )
    
    if is_token_expired(access_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Access token đã hết hạn"
        )
    
    payload = decode_token(access_token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Access token không hợp lệ"
        )
    
    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == int(user_id)).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User không tồn tại"
        )
    
    return user


def sync_user_content_counts(db: Session, user: User) -> User:
    """Recalculate denormalized user content counters from persisted rows."""
    documents_count = db.query(func.count(Document.id)).filter(
        Document.user_id == user.id
    ).scalar() or 0

    flashcards_count = db.query(func.count(Flashcard.id)).filter(
        Flashcard.user_id == user.id
    ).scalar() or 0

    user.documents_count = int(documents_count)
    user.flashcards_count = int(flashcards_count)
    return user


@app.post("/api/documents/generate-title", response_model=DocumentTitleResponse)
async def generate_title_for_document(
    request: DocumentTitleRequest,
    access_token: str,
    db: Session = Depends(get_db)
):
    """Generate a short editable document title from summary content."""
    try:
        get_user_from_token(access_token, db)

        title = await generate_document_title(
            request.summary_data,
            llm_endpoint=request.llm_endpoint,
            model_name=request.model_name,
        )

        return DocumentTitleResponse(
            success=True,
            message="Generated document title successfully",
            data={"title": title},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating document title: {str(e)}"
        )


def count_flashcards(flashcard_data: List[Dict[str, Any]]) -> int:
    """Count parsed flashcards inside full flashcard module output."""
    return sum(
        len(
            [
                card
                for card in block.get("flashcards", [])
                if str(card.get("question", "")).strip()
                and str(card.get("answer", "")).strip()
            ]
        )
        for block in flashcard_data
    )


@app.post("/api/flashcards/save", response_model=FlashcardCreateResponse)
def save_flashcards(
    request: FlashcardCreate,
    access_token: str,
    db: Session = Depends(get_db)
):
    """
    Luu bo flashcard cua user.
    flashcard_data nen la data.flashcard_data tra ve tu /api/flashcards/process.
    """
    try:
        user = get_user_from_token(access_token, db)

        if request.document_id is not None:
            document = db.query(Document).filter(
                Document.id == request.document_id,
                Document.user_id == user.id
            ).first()
            if not document:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Tai lieu khong ton tai hoac khong thuoc user"
                )

        total_cards = count_flashcards(request.flashcard_data)
        if total_cards <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Khong the luu flashcard set rong"
            )
        new_flashcard = Flashcard(
            user_id=user.id,
            document_id=request.document_id,
            title=request.title,
            source_file_name=request.source_file_name,
            flashcard_data=request.flashcard_data,
            total_cards=total_cards,
            tags=request.tags or [],
            is_favorite=False,
        )

        db.add(new_flashcard)
        db.flush()
        sync_user_content_counts(db, user)
        db.commit()
        db.refresh(new_flashcard)

        return FlashcardCreateResponse(
            success=True,
            message="Luu flashcard thanh cong",
            data=FlashcardResponse.model_validate(new_flashcard),
        )
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Loi khi luu flashcard: {str(e)}"
        )


@app.get("/api/flashcards/list", response_model=FlashcardListResponse)
def list_flashcards(
    access_token: str,
    document_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Lay danh sach bo flashcard cua user hien tai."""
    try:
        user = get_user_from_token(access_token, db)
        query = db.query(Flashcard).filter(
            Flashcard.user_id == user.id
        )
        if document_id is not None:
            query = query.filter(Flashcard.document_id == document_id)

        flashcards = query.order_by(Flashcard.created_at.desc()).all()

        return FlashcardListResponse(
            success=True,
            message="Lay danh sach flashcard thanh cong",
            data=[FlashcardListItem.model_validate(item) for item in flashcards],
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Loi khi lay danh sach flashcard: {str(e)}"
        )


@app.get("/api/flashcards/{flashcard_id}", response_model=FlashcardDetailResponse)
def get_flashcard(
    flashcard_id: int,
    access_token: str,
    db: Session = Depends(get_db)
):
    """Lay chi tiet mot bo flashcard va kiem tra ownership."""
    try:
        user = get_user_from_token(access_token, db)
        flashcard = db.query(Flashcard).filter(
            Flashcard.id == flashcard_id,
            Flashcard.user_id == user.id
        ).first()

        if not flashcard:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Flashcard khong ton tai"
            )

        return FlashcardDetailResponse(
            success=True,
            message="Lay chi tiet flashcard thanh cong",
            data=FlashcardResponse.model_validate(flashcard),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Loi khi lay chi tiet flashcard: {str(e)}"
        )


@app.delete("/api/flashcards/{flashcard_id}", response_model=BasicResponse)
def delete_flashcard(
    flashcard_id: int,
    access_token: str,
    db: Session = Depends(get_db)
):
    """Xoa bo flashcard cua user hien tai."""
    try:
        user = get_user_from_token(access_token, db)
        flashcard = db.query(Flashcard).filter(
            Flashcard.id == flashcard_id,
            Flashcard.user_id == user.id
        ).first()

        if not flashcard:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Flashcard khong ton tai"
            )

        db.delete(flashcard)
        db.flush()
        sync_user_content_counts(db, user)
        db.commit()

        return BasicResponse(
            success=True,
            message="Xoa flashcard thanh cong",
        )
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Loi khi xoa flashcard: {str(e)}"
        )


@app.put("/api/flashcards/{flashcard_id}/favorite", response_model=BasicResponse)
def toggle_flashcard_favorite(
    flashcard_id: int,
    request: FlashcardUpdateFavorite,
    access_token: str,
    db: Session = Depends(get_db)
):
    """Cap nhat trang thai yeu thich cua bo flashcard."""
    try:
        user = get_user_from_token(access_token, db)
        flashcard = db.query(Flashcard).filter(
            Flashcard.id == flashcard_id,
            Flashcard.user_id == user.id
        ).first()

        if not flashcard:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Flashcard khong ton tai"
            )

        flashcard.is_favorite = request.is_favorite
        flashcard.updated_at = datetime.now(timezone.utc)
        db.commit()

        return BasicResponse(
            success=True,
            message="Cap nhat yeu thich flashcard thanh cong",
        )
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Loi khi cap nhat flashcard: {str(e)}"
        )


@app.post("/api/documents/save", response_model=DocumentCreateResponse)
def save_document(
    request: DocumentCreate,
    access_token: str,
    db: Session = Depends(get_db)
):
    """
    Lưu tài liệu tóm tắt
    
    Query params:
    - access_token: Access token của user
    
    Request body:
    {
        "title": "Tên tài liệu",
        "summary_data": {
            "pages": {...},
            "full_summary": "...",
            "processing_time": "...",
            "num_pages": 3
        },
        "tags": ["Summary", "Flashcard"]
    }
    """
    try:
        user = get_user_from_token(access_token, db)
        ocr_data = request.ocr_data or {}
        source_file_name = request.source_file_name or ocr_data.get("file_name")
        extracted_text = request.extracted_text or ocr_data.get("extracted_text")
        
        # Tạo document mới
        new_document = Document(
            user_id=user.id,
            title=request.title,
            source_file_name=source_file_name,
            ocr_data=request.ocr_data,
            extracted_text=extracted_text,
            summary_data=request.summary_data,
            key_takeaways=request.key_takeaways or request.summary_data.get("key_takeaways"),
            tags=request.tags or [],
            is_favorite=False
        )
        
        db.add(new_document)
        db.flush()
        sync_user_content_counts(db, user)
        db.commit()
        db.refresh(new_document)
        
        document_response = DocumentResponse.model_validate(new_document)
        
        return DocumentCreateResponse(
            success=True,
            message="Lưu tài liệu thành công",
            data=document_response
        )
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi lưu tài liệu: {str(e)}"
        )


@app.get("/api/documents/list", response_model=DocumentListResponse)
def list_documents(
    access_token: str,
    db: Session = Depends(get_db)
):
    """
    Lấy danh sách tài liệu của user
    
    Query params:
    - access_token: Access token của user
    
    Returns:
    {
        "success": true,
        "data": [
            {
                "id": 1,
                "title": "Tài liệu 1",
                "tags": ["Summary"],
                "is_favorite": false,
                "created_at": "2026-05-11T..."
            }
        ]
    }
    """
    try:
        user = get_user_from_token(access_token, db)
        
        # Lấy danh sách documents của user, sắp xếp theo thời gian tạo (mới nhất trước)
        documents = db.query(Document).filter(
            Document.user_id == user.id
        ).order_by(Document.created_at.desc()).all()
        
        from schemas import DocumentListItem
        documents_response = [
            DocumentListItem.model_validate(doc) for doc in documents
        ]
        
        return DocumentListResponse(
            success=True,
            message="Lấy danh sách tài liệu thành công",
            data=documents_response
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi lấy danh sách tài liệu: {str(e)}"
        )


@app.get("/api/documents/{document_id}", response_model=DocumentDetailResponse)
def get_document(
    document_id: int,
    access_token: str,
    db: Session = Depends(get_db)
):
    """
    Lấy chi tiết tài liệu
    
    Path params:
    - document_id: ID của tài liệu
    
    Query params:
    - access_token: Access token của user
    """
    try:
        user = get_user_from_token(access_token, db)
        
        # Lấy document và kiểm tra ownership
        document = db.query(Document).filter(
            Document.id == document_id,
            Document.user_id == user.id
        ).first()
        
        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tài liệu không tồn tại"
            )
        
        document_response = DocumentResponse.model_validate(document)
        
        return DocumentDetailResponse(
            success=True,
            message="Lấy chi tiết tài liệu thành công",
            data=document_response
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi lấy chi tiết tài liệu: {str(e)}"
        )


@app.delete("/api/documents/{document_id}", response_model=BasicResponse)
def delete_document(
    document_id: int,
    access_token: str,
    db: Session = Depends(get_db)
):
    """
    Xóa tài liệu
    
    Path params:
    - document_id: ID của tài liệu
    
    Query params:
    - access_token: Access token của user
    """
    try:
        user = get_user_from_token(access_token, db)
        
        # Tìm và xóa document
        document = db.query(Document).filter(
            Document.id == document_id,
            Document.user_id == user.id
        ).first()
        
        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tài liệu không tồn tại"
            )
        
        linked_flashcards = db.query(Flashcard).filter(
            Flashcard.document_id == document_id,
            Flashcard.user_id == user.id
        ).all()
        for flashcard in linked_flashcards:
            db.delete(flashcard)

        db.delete(document)
        db.flush()
        sync_user_content_counts(db, user)
        db.commit()
        
        return BasicResponse(
            success=True,
            message="Xóa tài liệu thành công"
        )
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi xóa tài liệu: {str(e)}"
        )


@app.put("/api/documents/{document_id}/favorite", response_model=BasicResponse)
def toggle_favorite(
    document_id: int,
    request: DocumentUpdateFavorite,
    access_token: str,
    db: Session = Depends(get_db)
):
    """
    Cập nhật trạng thái yêu thích của tài liệu
    
    Path params:
    - document_id: ID của tài liệu
    
    Query params:
    - access_token: Access token của user
    
    Request body:
    {
        "is_favorite": true/false
    }
    """
    try:
        user = get_user_from_token(access_token, db)
        
        # Tìm document
        document = db.query(Document).filter(
            Document.id == document_id,
            Document.user_id == user.id
        ).first()
        
        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tài liệu không tồn tại"
            )
        
        # Update favorite status
        document.is_favorite = request.is_favorite
        document.updated_at = datetime.now(timezone.utc)
        db.commit()
        
        return BasicResponse(
            success=True,
            message="Cập nhật yêu thích thành công"
        )
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi cập nhật yêu thích: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=6010)
