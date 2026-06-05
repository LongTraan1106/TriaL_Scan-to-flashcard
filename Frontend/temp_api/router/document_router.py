from fastapi import APIRouter, Request, HTTPException, status
from models.schemas import DocumentCreate, DocumentPageCreate, FlashcardCreate, DocumentAIUpdate, PageOCRUpdate

router = APIRouter()

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_document(body: DocumentCreate, request: Request):
    """Tạo một document mới"""
    db = request.app.state.db
    
    user = await db.fetchrow("SELECT id FROM users WHERE id = $1", body.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User không tồn tại (hãy tạo user ở /api/users/ trước)")

    query = """
        INSERT INTO documents (user_id)
        VALUES ($1)
        RETURNING id
    """
    document_id = await db.fetchval(query, body.user_id)
    return {"message": "Tạo document thành công", "document_id": document_id}

@router.get("/{document_id}")
async def get_document(document_id: int, request: Request):
    """Lấy thông tin document bao gồm các trang ảnh và flashcard"""
    db = request.app.state.db
    
    doc = await db.fetchrow("SELECT * FROM documents WHERE id = $1", document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Không tìm thấy document")

    pages = await db.fetch("SELECT * FROM document_pages WHERE document_id = $1 ORDER BY page_number", document_id)
    flashcards = await db.fetch("SELECT * FROM flashcards WHERE document_id = $1", document_id)

    return {
        "document": dict(doc),
        "pages": [dict(p) for p in pages],
        "flashcards": [dict(f) for f in flashcards]
    }

@router.post("/pages/", status_code=status.HTTP_201_CREATED)
async def add_document_page(body: DocumentPageCreate, request: Request):
    """Thêm một trang quét (ảnh + ocr text) vào document"""
    db = request.app.state.db
    
    query = """
        INSERT INTO document_pages (document_id, url, ocr_text, page_number)
        VALUES ($1, $2, $3, $4)
        RETURNING id
    """
    try:
        page_id = await db.fetchval(query, body.document_id, body.url, body.ocr_text, body.page_number)
        return {"message": "Thêm trang thành công", "page_id": page_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail="Không thể thêm trang. Đảm bảo document_id tồn tại.")

@router.put("/pages/{page_id}/ocr")
async def update_page_ocr(page_id: int, body: PageOCRUpdate, user_id: int, request: Request):
    """Cập nhật lại văn bản OCR cho một trang cụ thể"""
    db = request.app.state.db
    
    page = await db.fetchrow("SELECT document_id FROM document_pages WHERE id = $1", page_id)
    if not page:
        raise HTTPException(status_code=404, detail="Trang ảnh không tồn tại")
        
    doc = await db.fetchrow("SELECT user_id FROM documents WHERE id = $1", page["document_id"])
    if doc["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Bạn không có quyền sửa văn bản trang này")
        
    await db.execute("UPDATE document_pages SET ocr_text = $1 WHERE id = $2", body.ocr_text, page_id)
    return {"message": "Đã cập nhật văn bản OCR thành công"}


@router.post("/flashcards/", status_code=status.HTTP_201_CREATED)
async def create_flashcard(body: FlashcardCreate, request: Request):
    """Tạo flashcard cho document"""
    db = request.app.state.db
    query = """
        INSERT INTO flashcards (document_id, front, back)
        VALUES ($1, $2, $3)
        RETURNING id
    """
    fc_id = await db.fetchval(query, body.document_id, body.front, body.back)
    return {"message": "Tạo flashcard thành công", "flashcard_id": str(fc_id)}

@router.put("/ai-result/")
async def update_ai_result(body: DocumentAIUpdate, request: Request):
    """Cập nhật phần title và tóm tắt (do AI tạo) cho document"""
    db = request.app.state.db
    query = """
        UPDATE documents
        SET title = COALESCE($1, title), 
            summary = COALESCE($2, summary), 
            updated_at = NOW()
        WHERE id = $3
        RETURNING id
    """
    updated_id = await db.fetchval(query, body.title, body.summary, body.document_id)
    if not updated_id:
        raise HTTPException(status_code=404, detail="Không tìm thấy document")
    return {"message": "Cập nhật kết quả AI thành công"}

@router.delete("/{document_id}")
async def delete_document(document_id: int, user_id: int, request: Request):
    """Xóa toàn bộ tài liệu (Chỉ người tạo mới được xóa)"""
    db = request.app.state.db
    
    doc = await db.fetchrow("SELECT user_id FROM documents WHERE id = $1", document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Tài liệu không tồn tại")
    if doc["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Chỉ người tạo tài liệu mới có quyền xóa")
        
    await db.execute("DELETE FROM documents WHERE id = $1", document_id)
    return {"message": "Đã xóa tài liệu và toàn bộ ảnh, flashcard thành công"}

@router.delete("/{document_id}/flashcards")
async def delete_all_flashcards(document_id: int, user_id: int, request: Request):
    """Xóa nguyên một set flashcard của tài liệu"""
    db = request.app.state.db
    
    doc = await db.fetchrow("SELECT user_id FROM documents WHERE id = $1", document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Tài liệu không tồn tại")
    if doc["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Chỉ người tạo tài liệu mới có quyền xóa bộ flashcard này")
        
    await db.execute("DELETE FROM flashcards WHERE document_id = $1", document_id)
    return {"message": "Đã xóa nguyên bộ flashcard thành công"}

@router.delete("/{document_id}/summary")
async def delete_summary(document_id: int, user_id: int, request: Request):
    """Xóa phần tóm tắt của tài liệu (Làm rỗng)"""
    db = request.app.state.db
    
    doc = await db.fetchrow("SELECT user_id FROM documents WHERE id = $1", document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Tài liệu không tồn tại")
    if doc["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Chỉ người tạo tài liệu mới có quyền xóa summary")
        
    await db.execute("UPDATE documents SET summary = NULL, updated_at = NOW() WHERE id = $1", document_id)
    return {"message": "Đã xóa phần tóm tắt thành công"}
