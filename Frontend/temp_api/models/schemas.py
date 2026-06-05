from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class DocumentCreate(BaseModel):
    user_id: int

class DocumentPageCreate(BaseModel):
    document_id: int
    url: str
    ocr_text: Optional[str] = ""
    page_number: int = 1

class PageOCRUpdate(BaseModel):
    ocr_text: str

class FlashcardCreate(BaseModel):
    document_id: int
    front: str
    back: str

class DocumentAIUpdate(BaseModel):
    document_id: int
    title: Optional[str] = None
    summary: Optional[str] = None


class GroupCreate(BaseModel):
    name: str
    description: str = ""
    teacher_id: int

class AddMember(BaseModel):
    teacher_id: int
    group_id: int
    user_id: int

class ShareDocument(BaseModel):
    group_id: int
    document_id: int
