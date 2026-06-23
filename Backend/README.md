# Study Helper Auth Backend

Backend xác thực (Authentication) cho ứng dụng Study Helper sử dụng FastAPI, PostgreSQL, và JWT.

## 🚀 Tính năng

- ✅ Sign Up - Đăng ký tài khoản mới
- ✅ Sign In - Đăng nhập với email và password
- ✅ Sign Out - Đăng xuất (thu hồi refresh token)
- ✅ Refresh Token - Cấp access token mới
- ✅ Get User Info - Lấy thông tin user hiện tại
- ✅ Password Hashing - Hash password với bcrypt
- ✅ JWT Tokens - Access token + Refresh token
- ✅ Input Validation - Validate username, email, password
- ✅ Database Storage - Lưu token vào database

## 📋 Yêu cầu

- Python 3.8+
- PostgreSQL 10+
- pip (package manager)

## ⚙️ Setup

### 1. Cài đặt dependencies

```bash
pip install -r requirements.txt
```

### 2. Cấu hình database

Sửa `config.py` - dòng `DATABASE_URL`, hoặc set biến môi trường `DATABASE_URL`:

```python
DATABASE_URL = "postgresql://username:password@localhost:5432/study_helper_db"
```

**Để tạo database PostgreSQL:**

```sql
CREATE DATABASE study_helper_db;
```

### 3. Cấu hình JWT Secret

Sửa `config.py` - dòng `SECRET_KEY`, hoặc set biến môi trường `SECRET_KEY` (QUAN TRỌNG cho production):

```python
SECRET_KEY = "your-secret-key-change-this-in-production"
```

**⚠️ IMPORTANT:** Thay đổi SECRET_KEY thành một key ngẫu nhiên mạnh trong production!

### 4. Chạy server

```bash
python main.py
```

API sẽ chạy theo `SERVER_HOST`/`SERVER_PORT` trong `config.py`.

Docs API: `http://<host>:<port>/docs`

## 📡 API Endpoints

### 1. Health Check
```
GET /health

Response:
{
  "success": true,
  "message": "API is running",
  "timestamp": "2024-05-01T10:00:00+00:00"
}
```

### 2. Sign Up
```
POST /api/auth/signup

Request:
{
  "username": "string (3-20 ký tự, chỉ chữ cái, số, _)",
  "email": "string (@gmail.com)",
  "password": "string (min 6, phải có uppercase + số)"
}

Response:
{
  "success": true,
  "message": "Đăng ký thành công",
  "data": {
    "id": 1,
    "username": "testuser",
    "email": "testuser@gmail.com",
    "created_at": "2024-05-01T10:00:00+00:00"
  }
}
```

### 3. Sign In
```
POST /api/auth/signin

Request:
{
  "email": "string",
  "password": "string"
}

Response:
{
  "success": true,
  "message": "Đăng nhập thành công",
  "data": {
    "user": {
      "id": 1,
      "username": "testuser",
      "email": "testuser@gmail.com",
      "created_at": "2024-05-01T10:00:00+00:00"
    },
    "tokens": {
      "access_token": "eyJhbGc...",
      "refresh_token": "eyJhbGc...",
      "token_type": "bearer"
    }
  }
}
```

### 4. Refresh Token
```
POST /api/auth/refresh

Request:
{
  "refresh_token": "string"
}

Response:
{
  "success": true,
  "message": "Làm mới token thành công",
  "data": {
    "access_token": "eyJhbGc...",
    "refresh_token": "eyJhbGc...",
    "token_type": "bearer"
  }
}
```

### 5. Sign Out
```
POST /api/auth/signout

Request:
{
  "refresh_token": "string"
}

Response:
{
  "success": true,
  "message": "Đăng xuất thành công"
}
```

### 6. Get Current User
```
GET /api/auth/me?access_token=string

Response:
{
  "success": true,
  "message": "Lấy thông tin user thành công",
  "data": {
    "id": 1,
    "username": "testuser",
    "email": "testuser@gmail.com",
    "created_at": "2024-05-01T10:00:00+00:00"
  }
}
```

## ✅ Chạy Tests

Chạy tất cả các test:

```bash
pytest test_auth.py -v
```

Hoặc chạy từ Python:

```bash
python test_auth.py
```

**Test coverage:**
- ✅ Health check
- ✅ Sign up (success, duplicate username, duplicate email, invalid formats)
- ✅ Sign in (success, wrong password, wrong email, token validation)
- ✅ Refresh token (success, invalid token)
- ✅ Sign out (success, token revocation)
- ✅ Get current user

## 📝 Validation Rules

### Username
- Độ dài: 3-20 ký tự
- Ký tự hợp lệ: chữ cái, số, dấu gạch dưới (_)
- Unique: không được trùng

### Email
- Format: phải kết thúc bằng @gmail.com
- Unique: không được trùng

### Password
- Độ dài tối thiểu: 6 ký tự
- Phải chứa: ít nhất 1 ký tự viết hoa (A-Z)
- Phải chứa: ít nhất 1 chữ số (0-9)

## 🔐 Bảo mật

- ✅ Password được hash bằng bcrypt (tự động salt)
- ✅ JWT tokens có expiration
- ✅ Access token: 30 phút
- ✅ Refresh token: 7 ngày
- ✅ Refresh token được lưu trong database và có thể thu hồi
- ✅ CORS được cấu hình (có thể thay đổi tại main.py)

## 📂 File Structure

```
auth-backend/
├── main.py              # FastAPI app + routes
├── models.py            # SQLAlchemy models
├── schemas.py           # Pydantic schemas
├── auth.py              # Auth utilities (JWT, password hashing)
├── database.py          # Database connection
├── requirements.txt     # Dependencies
├── test_auth.py         # Unit tests
└── README.md            # Documentation
```

## 🔄 Flow Example

### Sign Up → Sign In → Use API → Refresh → Sign Out

```
1. Sign Up
   POST /api/auth/signup
   → user created
   
2. Sign In
   POST /api/auth/signin
   → get access_token & refresh_token
   
3. Use API (Get Current User)
   GET /api/auth/me?access_token=...
   → get user info
   
4. Refresh Token (when access_token expires)
   POST /api/auth/refresh
   → get new access_token
   
5. Sign Out
   POST /api/auth/signout
   → refresh_token revoked
```

## 🚀 Deployment (Tự thực hiện)

Khi sẽ deploy lên server remote:

1. **Cấu hình database**: Thay đổi DATABASE_URL
2. **Cấu hình JWT**: Thay đổi SECRET_KEY (dùng environment variable)
3. **Cấu hình CORS**: Thay đổi `CORS_ALLOW_ORIGINS` trong `config.py` hoặc qua biến môi trường
4. **Chạy server**: Dùng Gunicorn hoặc tương đương

```bash
# Ví dụ với Gunicorn
gunicorn -w 4 -b 0.0.0.0:8000 main:app
```

## 📧 Support

Nếu có vấn đề, hãy kiểm tra:
- PostgreSQL đã chạy chưa?
- DATABASE_URL có chính xác không?
- Tất cả dependencies đã cài đặt chưa?

---

**Ready to integrate with React Native frontend!** 🎉
