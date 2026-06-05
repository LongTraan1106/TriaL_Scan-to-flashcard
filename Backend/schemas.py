from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from datetime import datetime
import re


class UserCreate(BaseModel):
    """Schema cho sign up request"""
    username: str
    email: str
    password: str
    role: str  # teacher, student

    @field_validator('username')
    def validate_username(cls, v):
        if len(v) > 20:
            raise ValueError('Username không được vượt quá 20 ký tự')
        if len(v) < 3:
            raise ValueError('Username phải có ít nhất 3 ký tự')
        if not re.match(r'^[a-zA-Z0-9_]+$', v):
            raise ValueError('Username chỉ được chứa chữ cái, số và dấu gạch dưới')
        return v

    @field_validator('email')
    def validate_email(cls, v):
        if not re.match(r'^[a-zA-Z0-9._%+-]+@gmail\.com$', v):
            raise ValueError('Email phải có định dạng @gmail.com')
        return v

    @field_validator('password')
    def validate_password(cls, v):
        if len(v) < 6:
            raise ValueError('Password phải có ít nhất 6 ký tự')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password phải chứa ít nhất 1 ký tự viết hoa')
        if not re.search(r'[0-9]', v):
            raise ValueError('Password phải chứa ít nhất 1 chữ số')
        return v

    @field_validator('role')
    def validate_role(cls, v):
        if v not in ['teacher', 'student']:
            raise ValueError('Role phải là teacher hoặc student')
        return v


class UserLogin(BaseModel):
    """Schema cho sign in request"""
    email: str
    password: str


class PasswordVerifyRequest(BaseModel):
    current_password: str


class ProfileUpdateRequest(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None


class TokenResponse(BaseModel):
    """Schema cho token response"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    """Schema cho user response"""
    id: int
    username: str
    email: str
    role: str
    avatar_url: Optional[str] = None
    documents_count: int = 0
    flashcards_count: int = 0
    groups_count: int = 0
    current_streak: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


class SignUpResponse(BaseModel):
    """Schema cho sign up response"""
    success: bool
    message: str
    data: Optional[UserResponse] = None


class SignInResponse(BaseModel):
    """Schema cho sign in response"""
    success: bool
    message: str
    data: Optional[dict] = None  # {user: UserResponse, tokens: TokenResponse}


class SignOutResponse(BaseModel):
    """Schema cho sign out response"""
    success: bool
    message: str


class RefreshTokenRequest(BaseModel):
    """Schema cho refresh token request"""
    refresh_token: str


class RefreshTokenResponse(BaseModel):
    """Schema cho refresh token response"""
    success: bool
    message: str
    data: Optional[TokenResponse] = None


class ErrorResponse(BaseModel):
    """Schema cho error response"""
    success: bool
    message: str
    data: Optional[dict] = None


# ==================== Group Schemas ====================

class GroupMemberResponse(BaseModel):
    """Schema cho group member response"""
    id: int
    group_id: int
    user_id: int
    username: str
    email: str
    avatar_url: Optional[str] = None
    member_role: str  # owner, admin, member
    joined_at: datetime

    class Config:
        from_attributes = True


class GroupCreate(BaseModel):
    """Schema cho tạo group request"""
    name: str
    description: Optional[str] = None
    is_public: bool = False
    avatar_key: str = "avatar_1"
    max_members: int = 25

    @field_validator('name')
    def validate_name(cls, v):
        if len(v) < 1:
            raise ValueError('Tên group không được để trống')
        if len(v) > 100:
            raise ValueError('Tên group không được vượt quá 100 ký tự')
        return v

    @field_validator('description')
    def validate_description(cls, v):
        if v and len(v) > 500:
            raise ValueError('Mô tả không được vượt quá 500 ký tự')
        return v


class GroupUpdate(BaseModel):
    """Schema cho cập nhật group"""
    name: Optional[str] = None
    description: Optional[str] = None
    is_public: Optional[bool] = None
    avatar_key: Optional[str] = None
    max_members: Optional[int] = None

    @field_validator('name')
    def validate_name(cls, v):
        if v and len(v) > 100:
            raise ValueError('Tên group không được vượt quá 100 ký tự')
        return v

    @field_validator('description')
    def validate_description(cls, v):
        if v and len(v) > 500:
            raise ValueError('Mô tả không được vượt quá 500 ký tự')
        return v


class GroupResponse(BaseModel):
    """Schema cho group response (basic)"""
    id: int
    name: str
    description: Optional[str]
    owner_id: int
    owner_name: Optional[str] = None
    is_public: bool
    member_count: int
    max_members: int = 25
    avatar_key: str = "avatar_1"
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class GroupDetailResponse(BaseModel):
    """Schema cho group detail response (với members)"""
    id: int
    name: str
    description: Optional[str]
    owner_id: int
    owner_name: str
    is_public: bool
    member_count: int
    max_members: int = 25
    avatar_key: str = "avatar_1"
    created_at: datetime
    updated_at: datetime
    members: list[GroupMemberResponse] = []

    class Config:
        from_attributes = True


class AddMembersRequest(BaseModel):
    """Schema cho add members request"""
    user_ids: list[int]

    @field_validator('user_ids')
    def validate_user_ids(cls, v):
        if not v:
            raise ValueError('Cần phải chọn ít nhất 1 user')
        return v


class ChangeMemberRoleRequest(BaseModel):
    """Schema cho change member role request"""
    member_role: str

    @field_validator('member_role')
    def validate_role(cls, v):
        if v not in ['admin', 'member']:
            raise ValueError('Role phải là admin hoặc member')
        return v


class TransferOwnershipRequest(BaseModel):
    """Schema cho transfer group ownership request"""
    target_user_id: int

    @field_validator('target_user_id')
    def validate_target_user_id(cls, v):
        if v < 1:
            raise ValueError('target_user_id khong hop le')
        return v


class SearchUsersRequest(BaseModel):
    """Schema cho search users request"""
    username: str

    @field_validator('username')
    def validate_username(cls, v):
        if len(v) < 1:
            raise ValueError('Username không được để trống')
        if len(v) > 20:
            raise ValueError('Username không được vượt quá 20 ký tự')
        return v


class GroupResponse_Basic(BaseModel):
    """Schema cho group response simple (không có members)"""
    success: bool
    message: str
    data: Optional[GroupResponse] = None


class GroupDetailResponse_API(BaseModel):
    """Schema cho group detail response (API return)"""
    success: bool
    message: str
    data: Optional[GroupDetailResponse] = None


class GroupListResponse(BaseModel):
    """Schema cho list groups response"""
    success: bool
    message: str
    data: Optional[list[GroupResponse]] = None


class GroupSharedItemCreate(BaseModel):
    """Schema cho share document/flashcard vao group"""
    item_type: str
    item_id: int

    @field_validator('item_type')
    def validate_item_type(cls, v):
        if v not in ['document', 'flashcard']:
            raise ValueError('item_type phai la document hoac flashcard')
        return v

    @field_validator('item_id')
    def validate_item_id(cls, v):
        if v < 1:
            raise ValueError('item_id khong hop le')
        return v


class GroupSharedItemResponse(BaseModel):
    """Schema cho shared item trong group"""
    id: int
    group_id: int
    item_type: str
    item_id: int
    title: str
    source_file_name: Optional[str] = None
    total_cards: Optional[int] = None
    shared_by_user_id: int
    shared_by_username: str
    created_at: datetime


class GroupSharedItemsResponse(BaseModel):
    """Schema cho danh sach shared items"""
    success: bool
    message: str
    data: Optional[list[GroupSharedItemResponse]] = None


# ==================== Document Schemas ====================

class DocumentCreate(BaseModel):
    """Schema cho save document request"""
    title: str
    source_file_name: Optional[str] = None
    ocr_data: Optional[dict] = None
    extracted_text: Optional[str] = None
    summary_data: dict  # {pages, full_summary, processing_time, num_pages}
    key_takeaways: Optional[list[str]] = None
    tags: Optional[list[str]] = None


class DocumentResponse(BaseModel):
    """Schema cho document response"""
    id: int
    user_id: int
    title: str
    source_file_name: Optional[str] = None
    ocr_data: Optional[dict] = None
    extracted_text: Optional[str] = None
    summary_data: dict
    key_takeaways: Optional[list[str]] = None
    tags: Optional[list[str]] = None
    is_favorite: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DocumentListItem(BaseModel):
    """Schema cho document list item"""
    id: int
    title: str
    source_file_name: Optional[str] = None
    tags: Optional[list[str]] = None
    is_favorite: bool
    created_at: datetime

    class Config:
        from_attributes = True


class DocumentUpdateFavorite(BaseModel):
    """Schema cho update favorite request"""
    is_favorite: bool


class DocumentListResponse(BaseModel):
    """Schema cho list documents response"""
    success: bool
    message: str
    data: Optional[list[DocumentListItem]] = None


class DocumentDetailResponse(BaseModel):
    """Schema cho document detail response"""
    success: bool
    message: str
    data: Optional[DocumentResponse] = None


class DocumentCreateResponse(BaseModel):
    """Schema cho create document response"""
    success: bool
    message: str
    data: Optional[DocumentResponse] = None


class BasicResponse(BaseModel):
    """Schema cho basic response (delete, update)"""
    success: bool
    message: str


# ==================== Flashcard Schemas ====================

class FlashcardCreate(BaseModel):
    """Schema cho save flashcard request"""
    title: str
    flashcard_data: list[dict]
    document_id: Optional[int] = None
    source_file_name: Optional[str] = None
    tags: Optional[list[str]] = None


class FlashcardResponse(BaseModel):
    """Schema cho flashcard response"""
    id: int
    user_id: int
    document_id: Optional[int] = None
    title: str
    source_file_name: Optional[str] = None
    flashcard_data: list[dict]
    total_cards: int
    tags: Optional[list[str]] = None
    is_favorite: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class FlashcardListItem(BaseModel):
    """Schema cho flashcard list item"""
    id: int
    document_id: Optional[int] = None
    title: str
    source_file_name: Optional[str] = None
    total_cards: int
    tags: Optional[list[str]] = None
    is_favorite: bool
    created_at: datetime

    class Config:
        from_attributes = True


class FlashcardCreateResponse(BaseModel):
    success: bool
    message: str
    data: Optional[FlashcardResponse] = None


class FlashcardListResponse(BaseModel):
    success: bool
    message: str
    data: Optional[list[FlashcardListItem]] = None


class FlashcardDetailResponse(BaseModel):
    success: bool
    message: str
    data: Optional[FlashcardResponse] = None


class FlashcardUpdateFavorite(BaseModel):
    is_favorite: bool
