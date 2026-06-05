from fastapi import FastAPI
from contextlib import asynccontextmanager
import os
import asyncpg
from dotenv import load_dotenv
from routers import document_router, group_router

load_dotenv()

DATABASE_URL = "DATABASE_URL"

db_pool = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_pool
    if DATABASE_URL:
        db_pool = await asyncpg.create_pool(DATABASE_URL)
        app.state.db = db_pool
        print("Đã kết nối PostgreSQL")
    else:
        print("Chưa cấu hình DATABASE_URL")
    yield
    if db_pool:
        await db_pool.close()
        print("Đã đóng kết nối PostgreSQL")

app = FastAPI(lifespan=lifespan, title="SEAPP API")

app.include_router(document_router.router, prefix="/api/documents", tags=["documents"])
app.include_router(group_router.router, prefix="/api/groups", tags=["groups"])

@app.get("/")
async def root():
    return {"message": "Welcome to SEAPP API!"}