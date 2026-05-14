from fastapi import APIRouter, Request, HTTPException, status
from models.schemas import GroupCreate, AddMember, ShareDocument

router = APIRouter()


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_group(body: GroupCreate, request: Request):
    db = request.app.state.db
    
    user = await db.fetchrow("SELECT role FROM users WHERE id = $1", body.teacher_id)
    if not user:
        raise HTTPException(status_code=404, detail="User không tồn tại (hãy tạo user ở /api/users/ trước)")
    
    if user["role"] != "teacher":
        raise HTTPException(status_code=403, detail="Chỉ teacher mới được tạo nhóm")

    query = """
        INSERT INTO groups (name, description, teacher_id)
        VALUES ($1, $2, $3)
        RETURNING id
    """
    group_id = await db.fetchval(query, body.name, body.description, body.teacher_id)
    return {"message": "Tạo nhóm thành công", "group_id": group_id}

@router.post("/members/")
async def add_member(body: AddMember, request: Request):
    db = request.app.state.db
    
    group = await db.fetchrow("SELECT teacher_id FROM groups WHERE id = $1", body.group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Nhóm không tồn tại")
    if group["teacher_id"] != body.teacher_id:
        raise HTTPException(status_code=403, detail="Chỉ chủ nhóm mới được thêm thành viên")

    user = await db.fetchrow("SELECT id FROM users WHERE id = $1", body.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Học sinh này không tồn tại trong hệ thống")

    query = """
        INSERT INTO group_members (group_id, user_id)
        VALUES ($1, $2)
    """
    try:
        await db.execute(query, body.group_id, body.user_id)
        return {"message": "Thêm thành viên thành công"}
    except Exception as e:
        raise HTTPException(status_code=400, detail="Không thể thêm. Có thể học sinh đã ở trong nhóm rồi.")

@router.post("/share/")
async def share_document(body: ShareDocument, request: Request):
    db = request.app.state.db
    
    group = await db.fetchrow("SELECT teacher_id FROM groups WHERE id = $1", body.group_id)
    doc = await db.fetchrow("SELECT user_id FROM documents WHERE id = $1", body.document_id)

    if not group:
        raise HTTPException(status_code=404, detail="Nhóm không tồn tại")
    if not doc:
        raise HTTPException(status_code=404, detail="Tài liệu không tồn tại")
        
    if group["teacher_id"] != doc["user_id"]:
        raise HTTPException(status_code=403, detail="Tài liệu này không thuộc về giáo viên quản lý nhóm. Không được phép chia sẻ!")

    query = """
        INSERT INTO shared_documents (document_id, group_id)
        VALUES ($1, $2)
    """
    try:
        await db.execute(query, body.document_id, body.group_id)
        return {"message": "Chia sẻ document cho nhóm thành công"}
    except Exception as e:
        raise HTTPException(status_code=400, detail="Không thể chia sẻ. Document không hợp lệ hoặc đã được chia sẻ rồi.")


@router.delete("/{group_id}")
async def delete_group(group_id: int, teacher_id: int, request: Request):
    """Xóa một nhóm (Chỉ chủ nhóm mới được xóa)"""
    db = request.app.state.db
    
    group = await db.fetchrow("SELECT teacher_id FROM groups WHERE id = $1", group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Nhóm không tồn tại")
    if group["teacher_id"] != teacher_id:
        raise HTTPException(status_code=403, detail="Chỉ chủ nhóm mới được xóa nhóm này")
        
    await db.execute("DELETE FROM groups WHERE id = $1", group_id)
    return {"message": "Đã xóa nhóm thành công (và toàn bộ dữ liệu liên quan)"}

@router.delete("/{group_id}/members/{user_id}")
async def remove_member(group_id: int, user_id: int, teacher_id: int, request: Request):
    """Đuổi học sinh khỏi nhóm (Chỉ chủ nhóm)"""
    db = request.app.state.db
    
    group = await db.fetchrow("SELECT teacher_id FROM groups WHERE id = $1", group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Nhóm không tồn tại")
    if group["teacher_id"] != teacher_id:
        raise HTTPException(status_code=403, detail="Chỉ chủ nhóm mới được đuổi thành viên")
        
    result = await db.execute("DELETE FROM group_members WHERE group_id = $1 AND user_id = $2", group_id, user_id)
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Học sinh không có trong nhóm này")
        
    return {"message": "Đã đuổi học sinh khỏi nhóm thành công"}
