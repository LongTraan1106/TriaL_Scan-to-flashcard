# Study Helper - Scan to Flashcard

Study Helper là ứng dụng mobile hỗ trợ học tập, cho phép người dùng scan hoặc upload tài liệu, trích xuất nội dung bằng OCR, tóm tắt nội dung và tạo flashcard tự động để ôn tập.

Dự án được xây dựng theo mô hình full-stack:

- **Frontend**: React Native + TypeScript
- **Backend**: FastAPI + PostgreSQL
- **AI modules**: OCR, summarization, flashcard generation, key takeaway extraction

---

## Tính năng chính

### 1. Authentication

- Đăng ký tài khoản
- Đăng nhập / đăng xuất
- Refresh token
- Quản lý phiên đăng nhập bằng JWT
- Chỉnh sửa profile
- Upload avatar
- Phân quyền người dùng theo role: `student`, `teacher`

### 2. Scan / Upload tài liệu

- Scan tài liệu bằng camera
- Upload file ảnh hoặc PDF
- Hỗ trợ các định dạng phổ biến như `.jpg`, `.jpeg`, `.png`, `.pdf`
- Gửi file lên backend để xử lý OCR

### 3. OCR

- Trích xuất text từ ảnh hoặc PDF
- Gom nhóm nội dung theo layout tài liệu
- Trả về text đã nhận diện và kết quả OCR có cấu trúc

### 4. Summary

- Tóm tắt nội dung đã OCR
- Tạo summary theo từng phần / từng trang
- Tạo bản tóm tắt tổng hợp của toàn bộ tài liệu

### 5. Flashcard

- Tạo bộ flashcard tự động từ kết quả OCR
- Mỗi flashcard gồm câu hỏi, câu trả lời và phần giải thích nếu có
- Lưu flashcard theo từng tài liệu
- Xem chi tiết bộ flashcard
- Đánh dấu yêu thích
- Xóa flashcard

### 6. Document Management

- Lưu tài liệu đã xử lý
- Xem danh sách tài liệu
- Xem chi tiết summary của từng tài liệu
- Đánh dấu tài liệu yêu thích
- Xóa tài liệu
- Tạo key takeaways cho tài liệu

### 7. Group Study

- Teacher có thể tạo group học tập
- Người dùng có thể tham gia group public
- Tìm kiếm group public
- Thêm thành viên vào group
- Đổi role thành viên: owner, admin, member
- Chuyển quyền owner
- Xóa thành viên hoặc rời group
- Chia sẻ document / flashcard vào group

---

## Công nghệ sử dụng

### Frontend

- React Native
- TypeScript
- React Navigation
- Async Storage
- React Native Vision Camera
- React Native Document Scanner
- React Native PDF
- React Native FS
- React Native Blob Util

### Backend

- FastAPI
- Uvicorn
- SQLAlchemy
- PostgreSQL
- Pydantic
- JWT authentication
- bcrypt password hashing
- PyMuPDF
- OpenCV
- PaddleOCR

### AI / LLM

- OCR service
- LLM-based summarization
- LLM-based flashcard generation
- LLM-based key takeaway extraction

---

## Cấu trúc thư mục

```bash
TriaL_Scan-to-flashcard/
├── Backend/
│   ├── main.py                 # FastAPI application và API routes
│   ├── auth.py                 # Xử lý JWT, hash password, verify token
│   ├── database.py             # Kết nối PostgreSQL
│   ├── models.py               # SQLAlchemy models
│   ├── schemas.py              # Pydantic schemas
│   ├── ocr_service.py          # OCR processing service
│   ├── summary_service.py      # Summary generation service
│   ├── flashcard_service.py    # Flashcard generation service
│   ├── takeaway_service.py     # Key takeaway generation service
│   ├── title_service.py        # Generate title cho document
│   ├── group_routes.py         # API quản lý group học tập
│   ├── reset_db.py             # Reset database
│   ├── requirements.txt        # Python dependencies
│   └── README.md               # README riêng cho backend
│
├── Frontend/
│   ├── App.tsx                 # Entry point của app
│   ├── screens/                # Các màn hình chính
│   ├── components/             # Component tái sử dụng
│   ├── navigation/             # Root navigator, tab navigator
│   ├── contexts/               # AuthContext, GroupContext
│   ├── services/               # API services
│   ├── types/                  # TypeScript types
│   ├── utils/                  # Helper utilities
│   ├── android/                # Android native project
│   ├── ios/                    # iOS native project
│   └── package.json            # Frontend dependencies
│
└── .gitignore
```

---

## Luồng xử lý chính

```text
User scan/upload tài liệu
        ↓
Frontend gửi file lên Backend
        ↓
Backend xử lý OCR
        ↓
Trích xuất text và layout
        ↓
Gửi nội dung vào LLM để tóm tắt
        ↓
Tạo key takeaways
        ↓
Tạo flashcards từ nội dung OCR
        ↓
Lưu document / flashcard vào database
        ↓
User xem lại, học flashcard hoặc chia sẻ vào group
```

---

## Database chính

Các bảng chính trong hệ thống:

| Bảng | Mô tả |
|---|---|
| `users` | Lưu thông tin người dùng, role, avatar, thống kê học tập |
| `refresh_tokens` | Lưu refresh token để quản lý đăng nhập |
| `documents` | Lưu tài liệu đã OCR và summary |
| `flashcards` | Lưu bộ flashcard được tạo từ tài liệu |
| `groups` | Lưu thông tin group học tập |
| `group_members` | Lưu thành viên trong group |
| `group_shared_items` | Lưu document / flashcard được chia sẻ vào group |

---

## Cài đặt Backend

### 1. Di chuyển vào thư mục backend

```bash
cd Backend
```

### 2. Tạo môi trường ảo

```bash
python -m venv venv
```

Kích hoạt môi trường:

```bash
# Windows
venv\Scripts\activate

# Linux / macOS
source venv/bin/activate
```

### 3. Cài dependencies

```bash
pip install -r requirements.txt
```

### 4. Cấu hình database

Tạo file `.env` hoặc chỉnh cấu hình database theo môi trường của bạn:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/study_helper_db
SECRET_KEY=your-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
HOST=0.0.0.0
PORT=8000
DEBUG=True
CORS_ORIGINS=*
```

> Không nên commit thông tin database thật hoặc secret key thật lên GitHub.

### 5. Chạy backend

```bash
python main.py
```

Hoặc chạy bằng uvicorn:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Backend mặc định chạy tại:

```text
http://localhost:8000
```

API docs:

```text
http://localhost:8000/docs
```

---

## Cài đặt Frontend

### 1. Di chuyển vào thư mục frontend

```bash
cd Frontend
```

### 2. Cài dependencies

```bash
npm install
```

### 3. Cấu hình API URL

Trong các file service của frontend, cập nhật `API_URL` về địa chỉ backend của bạn:

```ts
const API_URL = 'http://localhost:8000';
```

Nếu chạy trên điện thoại thật hoặc Android emulator, cần đổi `localhost` thành IP máy đang chạy backend, ví dụ:

```ts
const API_URL = 'http://192.168.1.10:8000';
```

### 4. Chạy Metro

```bash
npm start
```

### 5. Chạy Android

```bash
npm run android
```

### 6. Chạy iOS

```bash
npm run ios
```

---

## Một số API chính

### Auth

```http
POST /api/auth/signup
POST /api/auth/signin
POST /api/auth/refresh
POST /api/auth/signout
GET  /api/auth/me
PUT  /api/auth/me/profile
POST /api/auth/me/avatar
```

### OCR / Summary / Flashcard

```http
POST /api/ocr/process
POST /api/summary/process
POST /api/takeaways/process
POST /api/flashcards/process
```

### Documents

```http
POST   /api/documents/save
GET    /api/documents/list
GET    /api/documents/{document_id}
PUT    /api/documents/{document_id}/favorite
DELETE /api/documents/{document_id}
```

### Groups

```http
POST   /api/groups/create
GET    /api/groups
GET    /api/groups/search/public
GET    /api/groups/{group_id}
POST   /api/groups/{group_id}/join
POST   /api/groups/{group_id}/members
PUT    /api/groups/{group_id}/members/{user_id}/role
DELETE /api/groups/{group_id}/members/{user_id}
PUT    /api/groups/{group_id}/transfer-ownership
GET    /api/groups/{group_id}/shared-items
POST   /api/groups/{group_id}/shared-items
DELETE /api/groups/{group_id}/shared-items/{shared_item_id}
```

---

## Ghi chú khi chạy project

- Backend cần kết nối được PostgreSQL trước khi chạy app.
- Một số API xử lý AI cần endpoint LLM/OCR hoạt động ổn định.
- Frontend hiện dùng API URL cố định trong các service, nên cần chỉnh lại khi deploy hoặc chạy local.
- Khi test trên Android emulator, `localhost` của app không trỏ về máy tính host. Hãy dùng IP LAN hoặc cấu hình reverse port bằng ADB.
- Nếu dùng camera hoặc document scanner, cần cấp quyền camera/storage cho app.

---

## Hướng phát triển tiếp theo

- Thêm file `.env` riêng cho frontend để quản lý API URL dễ hơn
- Thêm Docker Compose cho backend + PostgreSQL
- Thêm migration tool như Alembic
- Thêm test cho OCR, summary và flashcard pipeline
- Cải thiện UI học flashcard: progress, spaced repetition, quiz mode
- Thêm chức năng export summary / flashcard ra PDF
- Thêm dashboard thống kê học tập theo ngày

---

## Tác giả

**LongTraan1106**

GitHub: `https://github.com/LongTraan1106`
