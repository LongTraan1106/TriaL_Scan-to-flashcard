"""
Reset database - Drop all tables and recreate with new schema
Run this script: python reset_db.py
"""

from database import engine, Base
from models import User, RefreshToken, Group, GroupMember, GroupSharedItem, Document, Flashcard

def reset_database():
    """Drop all tables and recreate them with new schema"""
    try:
        print("⏳ Dropping all tables...")
        Base.metadata.drop_all(bind=engine)
        print("✅ All tables dropped")
        
        print("⏳ Creating tables with new schema...")
        Base.metadata.create_all(bind=engine)
        print("✅ Tables created successfully!")
        print("\n📋 Database reset complete!")
        print("   - users table created with 'role' column")
        print("   - refresh_tokens table created")
        print("   - documents table created with key_takeaways column")
        print("\nYou can now sign up with teacher/student roles!")
        
    except Exception as e:
        print(f"❌ Error resetting database: {str(e)}")
        raise

if __name__ == "__main__":
    print("🚀 Starting database reset...\n")
    reset_database()
