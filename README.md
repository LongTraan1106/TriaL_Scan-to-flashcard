# Study Helper - Scan to Flashcard

Study Helper is a mobile learning application that allows users to scan or upload learning materials, extract text with OCR, summarize the content, and automatically generate flashcards for revision.

The project is built as a full-stack application:

- **Frontend**: React Native + TypeScript
- **Backend**: FastAPI + PostgreSQL
- **AI modules**: OCR, summarization, flashcard generation, and key takeaway extraction

---

## Main Features

### 1. Authentication

- User registration
- Login / logout
- Refresh token support
- JWT-based session management
- Profile editing
- Avatar upload
- User roles: `student`, `teacher`

### 2. Document Scan / Upload

- Scan documents using the device camera
- Upload image files or PDFs
- Support common formats such as `.jpg`, `.jpeg`, `.png`, and `.pdf`
- Send files to the backend for OCR processing

### 3. OCR

- Extract text from images or PDF files
- Group extracted content based on document layout
- Return recognized text and structured OCR results

### 4. Summary

- Summarize OCR-extracted content
- Generate summaries by section or page
- Generate an overall summary for the whole document

### 5. Flashcards

- Automatically generate flashcards from OCR results
- Each flashcard contains a question, an answer, and an optional explanation
- Store flashcards by document
- View flashcard set details
- Mark flashcards as favorite
- Delete flashcards

### 6. Document Management

- Save processed documents
- View the document list
- View detailed summaries for each document
- Mark documents as favorite
- Delete documents
- Generate key takeaways for documents

### 7. Group Study

- Teachers can create study groups
- Users can join public groups
- Search public groups
- Add members to groups
- Update member roles: owner, admin, member
- Transfer group ownership
- Remove members or leave groups
- Share documents / flashcards to groups

---

## Tech Stack

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

## Project Structure

```bash
TriaL_Scan-to-flashcard/
├── Backend/
│   ├── main.py                 # FastAPI application and API routes
│   ├── auth.py                 # JWT, password hashing, and token verification
│   ├── database.py             # PostgreSQL connection
│   ├── models.py               # SQLAlchemy models
│   ├── schemas.py              # Pydantic schemas
│   ├── ocr_service.py          # OCR processing service
│   ├── summary_service.py      # Summary generation service
│   ├── flashcard_service.py    # Flashcard generation service
│   ├── takeaway_service.py     # Key takeaway generation service
│   ├── title_service.py        # Document title generation service
│   ├── group_routes.py         # Group study APIs
│   ├── reset_db.py             # Database reset script
│   ├── requirements.txt        # Python dependencies
│   └── README.md               # Backend-specific README
│
├── Frontend/
│   ├── App.tsx                 # Application entry point
│   ├── screens/                # Main app screens
│   ├── components/             # Reusable UI components
│   ├── navigation/             # Root navigator and tab navigator
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

## Main Processing Flow

```text
User scans/uploads a document
        ↓
Frontend sends the file to the Backend
        ↓
Backend processes the file with OCR
        ↓
Text and layout are extracted
        ↓
Extracted content is sent to an LLM for summarization
        ↓
Key takeaways are generated
        ↓
Flashcards are generated from the OCR content
        ↓
Documents and flashcards are saved to the database
        ↓
User reviews summaries, studies flashcards, or shares them to a group
```

---

## Main Database Tables

| Table | Description |
|---|---|
| `users` | Stores user information, roles, avatars, and learning statistics |
| `refresh_tokens` | Stores refresh tokens for session management |
| `documents` | Stores OCR-processed documents and summaries |
| `flashcards` | Stores flashcard sets generated from documents |
| `groups` | Stores study group information |
| `group_members` | Stores members of each group |
| `group_shared_items` | Stores documents / flashcards shared to groups |

---

## Backend Setup

### 1. Move into the backend folder

```bash
cd Backend
```

### 2. Create a virtual environment

```bash
python -m venv venv
```

Activate the environment:

```bash
# Windows
venv\Scripts\activate

# Linux / macOS
source venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure the database

Create a `.env` file or update the database configuration based on your local environment:

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

> Do not commit real database credentials or secret keys to GitHub.

### 5. Run the backend

```bash
python main.py
```

Or run it with Uvicorn:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The backend will run at:

```text
http://localhost:8000
```

API documentation:

```text
http://localhost:8000/docs
```

---

## Frontend Setup

### 1. Move into the frontend folder

```bash
cd Frontend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure the API URL

In the frontend service files, update `API_URL` to point to your backend address:

```ts
const API_URL = 'http://localhost:8000';
```

When running on a real phone or Android emulator, replace `localhost` with the IP address of the machine running the backend, for example:

```ts
const API_URL = 'http://192.168.1.10:8000';
```

### 4. Start Metro

```bash
npm start
```

### 5. Run on Android

```bash
npm run android
```

### 6. Run on iOS

```bash
npm run ios
```

---

## Main API Endpoints

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

## Notes

- The backend must be connected to PostgreSQL before running the app.
- Some AI-related APIs require a stable OCR/LLM service.
- The frontend currently uses a fixed API URL inside service files, so it should be updated when running locally or deploying.
- On Android emulator, `localhost` inside the app does not point to the host machine. Use the host LAN IP address or configure ADB reverse port forwarding.
- Camera and file permissions are required when using camera scanning or document upload features.

---

## Future Improvements

- Add a frontend `.env` file for easier API URL configuration
- Add Docker Compose for the backend and PostgreSQL
- Add a migration tool such as Alembic
- Add tests for the OCR, summary, and flashcard pipeline
- Improve the flashcard learning UI with progress tracking, spaced repetition, and quiz mode
- Add export support for summaries / flashcards as PDF
- Add a learning statistics dashboard

---

## Author

**LongTraan1106**

GitHub: `https://github.com/LongTraan1106`
