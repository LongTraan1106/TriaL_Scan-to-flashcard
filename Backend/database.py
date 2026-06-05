from sqlalchemy import create_engine
from sqlalchemy import text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Cấu hình PostgreSQL
# Đối với development, bạn có thể thay đổi thông tin kết nối tại đây
DATABASE_URL=DATABASE_URL = "postgresql://postgres:longtran123@192.168.20.156:6020/SE_Auth"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def ensure_document_ocr_columns():
    """Add OCR columns for existing databases.

    Base.metadata.create_all() creates missing tables but does not alter tables
    that already exist, so this keeps older local/Postgres databases usable.
    """
    statements = [
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS source_file_name VARCHAR(255)",
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS ocr_data JSON",
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS extracted_text TEXT",
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS key_takeaways JSON",
    ]
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


def ensure_group_ui_columns():
    """Add group UI columns for existing databases."""
    statements = [
        "ALTER TABLE groups ADD COLUMN IF NOT EXISTS max_members INTEGER NOT NULL DEFAULT 25",
        "ALTER TABLE groups ADD COLUMN IF NOT EXISTS avatar_key VARCHAR(50) NOT NULL DEFAULT 'avatar_1'",
    ]
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


def ensure_user_profile_columns():
    """Add profile editing columns for existing databases."""
    statements = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500)",
    ]
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


def ensure_group_shared_items_table():
    """Create shared item relation table for existing databases."""
    statements = [
        """
        CREATE TABLE IF NOT EXISTS group_shared_items (
            id SERIAL PRIMARY KEY,
            group_id INTEGER NOT NULL,
            item_type VARCHAR(20) NOT NULL,
            item_id INTEGER NOT NULL,
            shared_by_user_id INTEGER NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT uq_group_shared_item UNIQUE (group_id, item_type, item_id)
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_group_shared_items_group_id ON group_shared_items (group_id)",
        "CREATE INDEX IF NOT EXISTS ix_group_shared_items_item_type ON group_shared_items (item_type)",
        "CREATE INDEX IF NOT EXISTS ix_group_shared_items_item_id ON group_shared_items (item_id)",
        "CREATE INDEX IF NOT EXISTS ix_group_shared_items_shared_by_user_id ON group_shared_items (shared_by_user_id)",
    ]
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


def get_db():
    """Dependency để lấy database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
