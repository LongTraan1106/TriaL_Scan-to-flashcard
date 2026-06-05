"""
Group Management Routes
Endpoints để quản lý các nhóm học tập
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_
from datetime import datetime, timezone
from database import get_db
from models import Group, GroupMember, GroupSharedItem, User, Document, Flashcard
from schemas import (
    GroupCreate, GroupUpdate, GroupResponse, GroupDetailResponse, AddMembersRequest,
    ChangeMemberRoleRequest, GroupResponse_Basic, 
    GroupDetailResponse_API, GroupListResponse, GroupMemberResponse,
    GroupSharedItemCreate, GroupSharedItemResponse, GroupSharedItemsResponse,
    TransferOwnershipRequest
)

router = APIRouter(prefix="/api/groups", tags=["groups"])


# ==================== Helper Functions ====================

def check_user_role_in_group(user_id: int, group_id: int, db: Session, required_role: str = None):
    """
    Check user's role in group
    required_role: "owner", "admin", None (any member)
    Returns: member role or None if not member
    """
    member = db.query(GroupMember).filter(
        and_(
            GroupMember.user_id == user_id,
            GroupMember.group_id == group_id,
            GroupMember.is_active == True
        )
    ).first()
    
    if not member:
        return None
    
    if required_role:
        if required_role == "owner" and member.member_role != "owner":
            return None
        elif required_role == "admin" and member.member_role not in ["owner", "admin"]:
            return None
    
    return member.member_role


def get_group_with_members(group_id: int, db: Session):
    """Get group with all active members"""
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        return None
    
    members = db.query(
        GroupMember,
        User.username,
        User.email,
        User.avatar_url
    ).join(User, GroupMember.user_id == User.id).filter(
        and_(
            GroupMember.group_id == group_id,
            GroupMember.is_active == True
        )
    ).all()
    
    return group, members


def serialize_group_detail(group, members, owner_user=None):
    """Serialize group with members for response"""
    members_list = []
    for member, username, email, avatar_url in members:
        members_list.append(GroupMemberResponse(
            id=member.id,
            group_id=member.group_id,
            user_id=member.user_id,
            username=username,
            email=email,
            avatar_url=avatar_url,
            member_role=member.member_role,
            joined_at=member.joined_at
        ))
    
    owner_name = owner_user.username if owner_user else "Unknown"
    
    return GroupDetailResponse(
        id=group.id,
        name=group.name,
        description=group.description,
        owner_id=group.owner_id,
        owner_name=owner_name,
        is_public=group.is_public,
        member_count=group.member_count,
        max_members=group.max_members,
        avatar_key=group.avatar_key,
        created_at=group.created_at,
        updated_at=group.updated_at,
        members=members_list
    )


def get_group_or_404(group_id: int, db: Session):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group khong ton tai"
        )
    return group


def ensure_active_group_member(user_id: int, group_id: int, db: Session):
    user_role = check_user_role_in_group(user_id, group_id, db)
    if not user_role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ban khong phai thanh vien cua group nay"
        )
    return user_role


def get_active_group_member_or_404(group_id: int, user_id: int, db: Session):
    member = db.query(GroupMember).filter(
        and_(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user_id,
            GroupMember.is_active == True
        )
    ).first()
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thanh vien khong ton tai trong group"
        )
    return member


def assert_single_owner(group_id: int, db: Session):
    owner_count = db.query(GroupMember).filter(
        and_(
            GroupMember.group_id == group_id,
            GroupMember.member_role == "owner",
            GroupMember.is_active == True
        )
    ).count()
    if owner_count != 1:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Group ownership khong hop le"
        )


def serialize_shared_item(shared_item, db: Session):
    owner = db.query(User).filter(User.id == shared_item.shared_by_user_id).first()
    owner_name = owner.username if owner else "Unknown"

    if shared_item.item_type == "document":
        item = db.query(Document).filter(Document.id == shared_item.item_id).first()
        if not item:
            return None
        return GroupSharedItemResponse(
            id=shared_item.id,
            group_id=shared_item.group_id,
            item_type=shared_item.item_type,
            item_id=shared_item.item_id,
            title=item.title,
            source_file_name=item.source_file_name,
            total_cards=None,
            shared_by_user_id=shared_item.shared_by_user_id,
            shared_by_username=owner_name,
            created_at=shared_item.created_at,
        )

    item = db.query(Flashcard).filter(Flashcard.id == shared_item.item_id).first()
    if not item:
        return None
    return GroupSharedItemResponse(
        id=shared_item.id,
        group_id=shared_item.group_id,
        item_type=shared_item.item_type,
        item_id=shared_item.item_id,
        title=item.title,
        source_file_name=item.source_file_name,
        total_cards=item.total_cards,
        shared_by_user_id=shared_item.shared_by_user_id,
        shared_by_username=owner_name,
        created_at=shared_item.created_at,
    )


# ==================== Create Group ====================

@router.post("/create", response_model=GroupResponse_Basic)
def create_group(
    group_data: GroupCreate,
    user_id: int = Query(...),  # From auth header
    user_role: str = Query(...),  # From auth header
    db: Session = Depends(get_db)
):
    """
    Create new group (teacher only)
    
    Query params:
    - user_id: ID của user (từ access token)
    - user_role: Role của user (từ access token)
    """
    try:
        # Check if user is teacher
        if user_role != "teacher":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Chỉ có teacher mới có thể tạo group"
            )
        
        # Create group
        new_group = Group(
            name=group_data.name,
            description=group_data.description,
            owner_id=user_id,
            is_public=group_data.is_public,
            member_count=1,
            max_members=group_data.max_members,
            avatar_key=group_data.avatar_key
        )
        
        db.add(new_group)
        db.flush()  # Get the group ID
        
        # Add owner as group member
        owner_member = GroupMember(
            group_id=new_group.id,
            user_id=user_id,
            member_role="owner",
            is_active=True
        )
        
        db.add(owner_member)
        db.commit()
        db.refresh(new_group)
        
        return GroupResponse_Basic(
            success=True,
            message="Tạo group thành công",
            data=GroupResponse.model_validate(new_group)
        )
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi server: {str(e)}"
        )


# ==================== Get User's Groups ====================

@router.get("", response_model=GroupListResponse)
def get_user_groups(
    user_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """
    Get all groups of user (owned + member of)
    
    Query params:
    - user_id: ID của user
    """
    try:
        # Get all active groups of user
        groups = db.query(Group).join(
            GroupMember, Group.id == GroupMember.group_id
        ).filter(
            and_(
                GroupMember.user_id == user_id,
                GroupMember.is_active == True
            )
        ).all()
        
        return GroupListResponse(
            success=True,
            message="Lấy danh sách group thành công",
            data=[GroupResponse.model_validate(g) for g in groups]
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi server: {str(e)}"
        )


# ==================== Search Public Groups ====================

@router.get("/search/public", response_model=GroupListResponse)
def search_public_groups(
    search_name: str = Query(...),
    user_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """
    Search public groups by name
    
    Query params:
    - search_name: Tên group để search
    - user_id: ID của user (để exclude groups they're already in)
    """
    try:
        joined_group_ids = db.query(GroupMember.group_id).filter(
            and_(
                GroupMember.user_id == user_id,
                GroupMember.is_active == True
            )
        ).all()
        joined_group_ids = [row[0] for row in joined_group_ids]

        filters = [
            Group.is_public == True,
            Group.name.ilike(f"%{search_name}%")
        ]
        if joined_group_ids:
            filters.append(~Group.id.in_(joined_group_ids))

        # Get public groups matching search with owner info
        groups = db.query(
            Group,
            User.username
        ).join(User, Group.owner_id == User.id).filter(
            and_(*filters)
        ).all()
        
        result = []
        for group, owner_username in groups:
            group_data = GroupResponse.model_validate(group)
            group_data.owner_name = owner_username
            result.append(group_data)
        
        return GroupListResponse(
            success=True,
            message="Tìm kiếm group thành công",
            data=result
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi server: {str(e)}"
        )


# ==================== Get Group Details ====================

@router.get("/{group_id}/shared-items", response_model=GroupSharedItemsResponse)
def get_group_shared_items(
    group_id: int,
    user_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """Get documents/flashcards shared in a group."""
    try:
        get_group_or_404(group_id, db)
        ensure_active_group_member(user_id, group_id, db)

        shared_items = db.query(GroupSharedItem).filter(
            GroupSharedItem.group_id == group_id
        ).order_by(GroupSharedItem.created_at.desc()).all()

        result = []
        for shared_item in shared_items:
            item_data = serialize_shared_item(shared_item, db)
            if item_data:
                result.append(item_data)

        return GroupSharedItemsResponse(
            success=True,
            message="Lay danh sach shared items thanh cong",
            data=result
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Loi server: {str(e)}"
        )


@router.post("/{group_id}/shared-items", response_model=GroupSharedItemsResponse)
def share_item_to_group(
    group_id: int,
    request: GroupSharedItemCreate,
    user_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """Share an owned document or flashcard set into a group."""
    try:
        get_group_or_404(group_id, db)
        ensure_active_group_member(user_id, group_id, db)

        if request.item_type == "document":
            item = db.query(Document).filter(
                and_(Document.id == request.item_id, Document.user_id == user_id)
            ).first()
            if not item:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Document khong ton tai hoac khong thuoc ve ban"
                )
        else:
            item = db.query(Flashcard).filter(
                and_(Flashcard.id == request.item_id, Flashcard.user_id == user_id)
            ).first()
            if not item:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Flashcard set khong ton tai hoac khong thuoc ve ban"
                )

        existing = db.query(GroupSharedItem).filter(
            and_(
                GroupSharedItem.group_id == group_id,
                GroupSharedItem.item_type == request.item_type,
                GroupSharedItem.item_id == request.item_id,
            )
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Item nay da duoc share vao group"
            )

        shared_item = GroupSharedItem(
            group_id=group_id,
            item_type=request.item_type,
            item_id=request.item_id,
            shared_by_user_id=user_id,
        )
        db.add(shared_item)
        db.commit()

        refreshed_items = db.query(GroupSharedItem).filter(
            GroupSharedItem.group_id == group_id
        ).order_by(GroupSharedItem.created_at.desc()).all()
        result = [
            item_data
            for item_data in (serialize_shared_item(item, db) for item in refreshed_items)
            if item_data
        ]

        return GroupSharedItemsResponse(
            success=True,
            message="Share item vao group thanh cong",
            data=result
        )
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Loi server: {str(e)}"
        )


@router.delete("/{group_id}/shared-items/{shared_item_id}", response_model=GroupSharedItemsResponse)
def remove_group_shared_item(
    group_id: int,
    shared_item_id: int,
    user_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """Remove a shared item relation from group without deleting original item."""
    try:
        get_group_or_404(group_id, db)
        user_role = ensure_active_group_member(user_id, group_id, db)

        shared_item = db.query(GroupSharedItem).filter(
            and_(
                GroupSharedItem.id == shared_item_id,
                GroupSharedItem.group_id == group_id,
            )
        ).first()
        if not shared_item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Shared item khong ton tai trong group"
            )

        can_remove = (
            shared_item.shared_by_user_id == user_id or
            user_role in ["owner", "admin"]
        )
        if not can_remove:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Ban khong co quyen xoa shared item nay"
            )

        db.delete(shared_item)
        db.commit()

        refreshed_items = db.query(GroupSharedItem).filter(
            GroupSharedItem.group_id == group_id
        ).order_by(GroupSharedItem.created_at.desc()).all()
        result = [
            item_data
            for item_data in (serialize_shared_item(item, db) for item in refreshed_items)
            if item_data
        ]

        return GroupSharedItemsResponse(
            success=True,
            message="Xoa shared item khoi group thanh cong",
            data=result
        )
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Loi server: {str(e)}"
        )


@router.get("/{group_id}", response_model=GroupDetailResponse_API)
def get_group_details(
    group_id: int,
    user_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """
    Get group details with members
    - For public groups: anyone can view (doesn't need to be member)
    - For private groups: only members can view
    
    Path params:
    - group_id: ID của group
    
    Query params:
    - user_id: ID của user
    """
    try:
        # Get group first
        group = db.query(Group).filter(Group.id == group_id).first()
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Group không tồn tại"
            )
        
        # For private groups, check membership
        if not group.is_public:
            user_role = check_user_role_in_group(user_id, group_id, db)
            if not user_role:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Bạn không phải thành viên của group này"
                )
        
        # Get group with members
        result = get_group_with_members(group_id, db)
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Group không tồn tại"
            )
        
        group, members = result
        
        # Get owner user
        owner_user = db.query(User).filter(User.id == group.owner_id).first()
        
        return GroupDetailResponse_API(
            success=True,
            message="Lấy chi tiết group thành công",
            data=serialize_group_detail(group, members, owner_user)
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi server: {str(e)}"
        )


# ==================== Add Members to Group ====================

@router.post("/{group_id}/members", response_model=GroupDetailResponse_API)
def add_members_to_group(
    group_id: int,
    request: AddMembersRequest,
    user_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """
    Add members to group (owner only)
    
    Path params:
    - group_id: ID của group
    
    Query params:
    - user_id: ID của user (must be owner)
    """
    try:
        # Check if user is owner
        user_role = check_user_role_in_group(user_id, group_id, db, required_role="owner")
        if not user_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Chỉ có owner mới có thể mời thành viên"
            )
        
        # Get group
        group = db.query(Group).filter(Group.id == group_id).first()
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Group không tồn tại"
            )
        
        # Check users exist and not already members
        added_count = 0
        for uid in request.user_ids:
            if group.member_count + added_count >= group.max_members:
                break

            # Check user exists
            user = db.query(User).filter(User.id == uid).first()
            if not user:
                continue
            
            # Check if already member
            existing = db.query(GroupMember).filter(
                and_(
                    GroupMember.group_id == group_id,
                    GroupMember.user_id == uid,
                    GroupMember.is_active == True
                )
            ).first()
            if existing:
                continue
            
            # Add as member
            new_member = GroupMember(
                group_id=group_id,
                user_id=uid,
                member_role="member",
                is_active=True
            )
            db.add(new_member)
            added_count += 1
        
        # Update member count
        group.member_count += added_count
        group.updated_at = datetime.now(timezone.utc)
        db.commit()
        
        # Return updated group with members
        result = get_group_with_members(group_id, db)
        group, members = result
        
        # Get owner user
        owner_user = db.query(User).filter(User.id == group.owner_id).first()
        
        return GroupDetailResponse_API(
            success=True,
            message=f"Thêm {added_count} thành viên thành công",
            data=serialize_group_detail(group, members, owner_user)
        )
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi server: {str(e)}"
        )


# ==================== Join Public Group ====================

@router.post("/{group_id}/join")
def join_public_group(
    group_id: int,
    user_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """
    Join a public group (user can join themselves)
    
    Path params:
    - group_id: ID của group
    
    Query params:
    - user_id: ID của user
    """
    try:
        # Get group
        group = db.query(Group).filter(Group.id == group_id).first()
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Group không tồn tại"
            )
        
        # Check if group is public
        if not group.is_public:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Chỉ có thể tham gia group công khai"
            )
        
        # Check if user exists
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User không tồn tại"
            )
        
        # Check if already member
        existing = db.query(GroupMember).filter(
            and_(
                GroupMember.group_id == group_id,
                GroupMember.user_id == user_id,
                GroupMember.is_active == True
            )
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Bạn đã là thành viên của group này"
            )
        
        if group.member_count >= group.max_members:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Group Ä‘Ã£ Ä‘áº§y"
            )

        # Add user to group
        new_member = GroupMember(
            group_id=group_id,
            user_id=user_id,
            member_role="member",
            is_active=True
        )
        db.add(new_member)
        
        # Update member count
        group.member_count += 1
        group.updated_at = datetime.now(timezone.utc)
        db.commit()
        
        return {
            "success": True,
            "message": "Tham gia group thành công",
            "data": {
                "id": group.id,
                "name": group.name,
                "member_count": group.member_count,
                "max_members": group.max_members,
                "avatar_key": group.avatar_key
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi server: {str(e)}"
        )


# ==================== Change Member Role ====================

@router.put("/{group_id}/members/{target_user_id}/role")
def change_member_role(
    group_id: int,
    target_user_id: int,
    request: ChangeMemberRoleRequest,
    user_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """
    Change member role (owner only)
    
    Path params:
    - group_id: ID của group
    - target_user_id: ID của user cần thay đổi role
    
    Query params:
    - user_id: ID của user (must be owner)
    """
    try:
        get_group_or_404(group_id, db)

        if target_user_id == user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Owner khong the tu doi role cua minh"
            )

        # Check if requester is owner
        user_role = check_user_role_in_group(user_id, group_id, db, required_role="owner")
        if not user_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Chỉ có owner mới có thể thay đổi role"
            )
        
        # Check target member exists
        member = get_active_group_member_or_404(group_id, target_user_id, db)
        
        if not member:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Thành viên không tồn tại trong group"
            )
        
        # Cannot change owner role
        if member.member_role == "owner":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Không thể thay đổi role của owner"
            )
        
        # Update role
        member.member_role = request.member_role
        assert_single_owner(group_id, db)
        db.commit()
        
        return {
            "success": True,
            "message": f"Thay đổi role thành {request.member_role} thành công"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi server: {str(e)}"
        )


# ==================== Remove Member ====================

@router.delete("/{group_id}/members/{target_user_id}")
def remove_member(
    group_id: int,
    target_user_id: int,
    user_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """
    Remove member from group (owner only, or self-leave)
    
    Path params:
    - group_id: ID của group
    - target_user_id: ID của user cần xóa
    
    Query params:
    - user_id: ID của user (must be owner or removing self)
    """
    try:
        group = get_group_or_404(group_id, db)

        # Check if user is owner or removing themselves
        user_role = check_user_role_in_group(user_id, group_id, db)
        if not user_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn không phải thành viên của group này"
            )
        
        # If removing someone else, must be owner
        if target_user_id != user_id and user_role not in ["owner", "admin"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Chỉ có owner mới có thể xóa thành viên"
            )
        
        # Get target member
        member = get_active_group_member_or_404(group_id, target_user_id, db)
        
        if not member:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Thành viên không tồn tại"
            )
        
        if target_user_id != user_id and user_role == "admin" and member.member_role != "member":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin chi co the xoa member thuong"
            )

        # Cannot remove owner
        if member.member_role == "owner":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Không thể xóa owner khỏi group"
            )
        
        # Mark as inactive (soft delete)
        member.is_active = False
        
        # Update group member count
        group.member_count = max(0, group.member_count - 1)
        group.updated_at = datetime.now(timezone.utc)
        assert_single_owner(group_id, db)
        
        db.commit()
        
        return {
            "success": True,
            "message": "Xóa thành viên thành công"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi server: {str(e)}"
        )


# ==================== Update Group ====================

@router.put("/{group_id}/transfer-ownership", response_model=GroupDetailResponse_API)
def transfer_group_ownership(
    group_id: int,
    request: TransferOwnershipRequest,
    user_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """Transfer ownership to another active group member. Owner only."""
    try:
        group = get_group_or_404(group_id, db)
        requester = get_active_group_member_or_404(group_id, user_id, db)
        if requester.member_role != "owner":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Chi owner moi co the transfer ownership"
            )

        if request.target_user_id == user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Target owner phai la member khac"
            )

        target = get_active_group_member_or_404(group_id, request.target_user_id, db)
        if target.member_role == "owner":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User nay da la owner"
            )

        requester.member_role = "admin"
        target.member_role = "owner"
        group.owner_id = request.target_user_id
        group.updated_at = datetime.now(timezone.utc)
        assert_single_owner(group_id, db)
        db.commit()

        result = get_group_with_members(group_id, db)
        group, members = result
        owner_user = db.query(User).filter(User.id == group.owner_id).first()

        return GroupDetailResponse_API(
            success=True,
            message="Transfer ownership thanh cong",
            data=serialize_group_detail(group, members, owner_user)
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Loi server: {str(e)}"
        )


@router.put("/{group_id}", response_model=GroupResponse_Basic)
def update_group(
    group_id: int,
    group_data: GroupUpdate,
    user_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """
    Update group (owner only)
    
    Path params:
    - group_id: ID của group
    
    Query params:
    - user_id: ID của user (must be owner)
    """
    try:
        # Check if user is owner
        user_role = check_user_role_in_group(user_id, group_id, db, required_role="owner")
        if not user_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Chỉ có owner mới có thể chỉnh sửa group"
            )
        
        # Get group
        group = db.query(Group).filter(Group.id == group_id).first()
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Group không tồn tại"
            )
        
        # Update fields if provided
        if group_data.name:
            group.name = group_data.name
        if group_data.description is not None:
            group.description = group_data.description
        if group_data.is_public is not None:
            group.is_public = group_data.is_public
        if group_data.avatar_key is not None:
            group.avatar_key = group_data.avatar_key
        if group_data.max_members is not None:
            if group_data.max_members < group.member_count:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Sá»‘ thÃ nh viÃªn tá»‘i Ä‘a khÃ´ng thá»ƒ nhá» hÆ¡n sá»‘ thÃ nh viÃªn hiá»‡n táº¡i"
                )
            group.max_members = group_data.max_members
        
        group.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(group)
        
        return GroupResponse_Basic(
            success=True,
            message="Cập nhật group thành công",
            data=GroupResponse.model_validate(group)
        )
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi server: {str(e)}"
        )


# ==================== Delete Group ====================

@router.delete("/{group_id}")
def delete_group(
    group_id: int,
    user_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """
    Delete group (owner only)
    
    Path params:
    - group_id: ID của group
    
    Query params:
    - user_id: ID của user (must be owner)
    """
    try:
        # Check if user is owner
        user_role = check_user_role_in_group(user_id, group_id, db, required_role="owner")
        if not user_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Chỉ có owner mới có thể xóa group"
            )
        
        # Get group
        group = db.query(Group).filter(Group.id == group_id).first()
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Group không tồn tại"
            )
        
        # Delete group members
        db.query(GroupMember).filter(GroupMember.group_id == group_id).delete()

        # Delete share relations only, not original documents/flashcards
        db.query(GroupSharedItem).filter(GroupSharedItem.group_id == group_id).delete()
        
        # Delete group
        db.delete(group)
        db.commit()
        
        return {
            "success": True,
            "message": "Xóa group thành công"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi server: {str(e)}"
        )


# ==================== Search Users ====================

@router.get("/users/search")
def search_users(
    username: str = Query(...),
    exclude_group_id: int = Query(None),
    db: Session = Depends(get_db)
):
    """
    Search users by username for inviting
    
    Query params:
    - username: Username để search
    - exclude_group_id: Group ID để exclude users already in group
    """
    try:
        # Search users by username
        users = db.query(User).filter(
            User.username.ilike(f"%{username}%")
        ).all()
        
        # If exclude_group_id provided, filter out members
        if exclude_group_id:
            member_ids = db.query(GroupMember.user_id).filter(
                and_(
                    GroupMember.group_id == exclude_group_id,
                    GroupMember.is_active == True
                )
            ).all()
            member_ids = [m[0] for m in member_ids]
            users = [u for u in users if u.id not in member_ids]
        
        result = [
            {
                "id": u.id,
                "username": u.username,
                "email": u.email,
                "role": u.role,
                "avatar_url": u.avatar_url
            }
            for u in users
        ]
        
        return {
            "success": True,
            "message": "Tìm kiếm user thành công",
            "data": result
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi server: {str(e)}"
        )
