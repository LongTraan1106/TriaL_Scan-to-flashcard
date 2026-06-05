from sqlalchemy import Column, String, DateTime, Integer, Boolean, JSON, Text, UniqueConstraint
from database import Base
from datetime import datetime, timezone


class User(Base):
    """Model người dùng"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(20), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), default="student", nullable=False)  # teacher, student
    avatar_url = Column(String(500), nullable=True)
    # User statistics
    documents_count = Column(Integer, default=0)  # Số tài liệu
    flashcards_count = Column(Integer, default=0)  # Số flashcard
    groups_count = Column(Integer, default=0)  # Số group
    current_streak = Column(Integer, default=0)  # Current streak days
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class RefreshToken(Base):
    """Model lưu trữ refresh token"""
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    token = Column(String(500), unique=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    is_revoked = Column(Integer, default=0)  # 0 = active, 1 = revoked


class Group(Base):
    """Model nhóm học tập"""
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    description = Column(String(500), nullable=True)
    owner_id = Column(Integer, nullable=False, index=True)  # FK to users.id
    is_public = Column(Boolean, default=False, nullable=False)
    member_count = Column(Integer, default=1)  # Include owner
    max_members = Column(Integer, default=25, nullable=False)
    avatar_key = Column(String(50), default="avatar_1", nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class GroupMember(Base):
    """Model thành viên nhóm"""
    __tablename__ = "group_members"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, nullable=False, index=True)  # FK to groups.id
    user_id = Column(Integer, nullable=False, index=True)  # FK to users.id
    member_role = Column(String(20), default="member", nullable=False)  # owner, admin, member
    joined_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    is_active = Column(Boolean, default=True, nullable=False)  # For tracking leave status


class GroupSharedItem(Base):
    """Model quan he chia se document/flashcard vao group."""
    __tablename__ = "group_shared_items"
    __table_args__ = (
        UniqueConstraint("group_id", "item_type", "item_id", name="uq_group_shared_item"),
    )

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, nullable=False, index=True)
    item_type = Column(String(20), nullable=False, index=True)  # document, flashcard
    item_id = Column(Integer, nullable=False, index=True)
    shared_by_user_id = Column(Integer, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class Document(Base):
    """Model tài liệu đã tóm tắt"""
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)  # FK to users.id
    title = Column(String(255), nullable=False, index=True)
    source_file_name = Column(String(255), nullable=True)
    ocr_data = Column(JSON, nullable=True)  # Luu full output tu /api/ocr/process
    extracted_text = Column(Text, nullable=True)  # Text ghep tu OCR de search/debug nhanh
    summary_data = Column(JSON, nullable=False)  # Lưu {pages, full_summary, processing_time, num_pages}
    key_takeaways = Column(JSON, nullable=True)  # Luu cac y chinh rut ra tu summary/OCR
    tags = Column(JSON, nullable=True)  # ['Summary', 'Flashcard', ...]
    is_favorite = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class Flashcard(Base):
    """Model luu bo flashcard cua tung user."""
    __tablename__ = "flashcards"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    document_id = Column(Integer, nullable=True, index=True)
    title = Column(String(255), nullable=False, index=True)
    source_file_name = Column(String(255), nullable=True)
    flashcard_data = Column(JSON, nullable=False)  # Full output tu flashcard module
    total_cards = Column(Integer, default=0, nullable=False)
    tags = Column(JSON, nullable=True)
    is_favorite = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
