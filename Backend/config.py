import os


def _env(name: str, default: str) -> str:
    value = os.getenv(name)
    return value if value not in (None, "") else default


def _env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value in (None, ""):
        return default
    return int(value)


def _env_float(name: str, default: float) -> float:
    value = os.getenv(name)
    if value in (None, ""):
        return default
    return float(value)


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value in (None, ""):
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _env_list(name: str, default: list[str]) -> list[str]:
    value = os.getenv(name)
    if value in (None, ""):
        return list(default)
    return [item.strip() for item in value.split(",") if item.strip()]


# App/server
APP_TITLE = _env("APP_TITLE", "Study Helper Auth API")
APP_DESCRIPTION = _env("APP_DESCRIPTION", "API xac thuc cho Study Helper App")
APP_VERSION = _env("APP_VERSION", "1.0.0")
SERVER_HOST = _env("SERVER_HOST", "0.0.0.0")
SERVER_PORT = _env_int("SERVER_PORT", 6010)

# Database
DATABASE_URL = _env(
    "DATABASE_URL",
    "postgresql://postgres:longtran123@192.168.20.156:6020/SE_Auth",
)

# JWT/auth
SECRET_KEY = _env("SECRET_KEY", "your-secret-key-change-this-in-production")
JWT_ALGORITHM = _env("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = _env_int("ACCESS_TOKEN_EXPIRE_MINUTES", 30)
REFRESH_TOKEN_EXPIRE_DAYS = _env_int("REFRESH_TOKEN_EXPIRE_DAYS", 7)

# CORS
CORS_ALLOW_ORIGINS = _env_list("CORS_ALLOW_ORIGINS", ["*"])
CORS_ALLOW_CREDENTIALS = _env_bool("CORS_ALLOW_CREDENTIALS", True)
CORS_ALLOW_METHODS = _env_list("CORS_ALLOW_METHODS", ["*"])
CORS_ALLOW_HEADERS = _env_list("CORS_ALLOW_HEADERS", ["*"])

# Uploads
UPLOAD_ROOT_DIR = _env("UPLOAD_ROOT_DIR", "uploads")
UPLOAD_PUBLIC_PATH = _env("UPLOAD_PUBLIC_PATH", "/uploads")
AVATAR_UPLOAD_DIR_NAME = _env("AVATAR_UPLOAD_DIR_NAME", "avatars")
ALLOWED_AVATAR_TYPES = set(
    _env_list("ALLOWED_AVATAR_TYPES", ["image/jpeg", "image/png", "image/webp"])
)
MAX_AVATAR_BYTES = _env_int("MAX_AVATAR_BYTES", 5 * 1024 * 1024)

# LLM endpoints/models
LLM_API_URL = _env("LLM_API_URL", "http://192.168.20.150:6011/v1/chat/completions")
API_DEFAULT_LLM_API_URL = _env("API_DEFAULT_LLM_API_URL", LLM_API_URL)
API_DEFAULT_MODEL_NAME = _env(
    "API_DEFAULT_MODEL_NAME",
    "Qwen3.5-9B-Q8_0.gguf",
)
SUMMARY_MODEL_NAME = _env("SUMMARY_MODEL_NAME", "Qwen3.5-9B-Q8_0.gguf")
STUDY_MODEL_NAME = _env("STUDY_MODEL_NAME", "Qwen3.5-9B-Q8_0.gguf")
FLASHCARD_MODEL_NAME = _env("FLASHCARD_MODEL_NAME", STUDY_MODEL_NAME)
TAKEAWAY_MODEL_NAME = _env("TAKEAWAY_MODEL_NAME", STUDY_MODEL_NAME)
TITLE_LLM_API_URL = _env(
    "TITLE_LLM_API_URL",
    "http://192.168.20.150:6011/v1/chat/completions",
)
TITLE_MODEL_NAME = _env("TITLE_MODEL_NAME", SUMMARY_MODEL_NAME)

# LLM request timeouts
SUMMARY_LLM_TIMEOUT_SECONDS = _env_float("SUMMARY_LLM_TIMEOUT_SECONDS", 120.0)
FLASHCARD_LLM_TIMEOUT_SECONDS = _env_float("FLASHCARD_LLM_TIMEOUT_SECONDS", 120.0)
TAKEAWAY_LLM_TIMEOUT_SECONDS = _env_float("TAKEAWAY_LLM_TIMEOUT_SECONDS", 90.0)
TITLE_LLM_TIMEOUT_SECONDS = _env_float("TITLE_LLM_TIMEOUT_SECONDS", 60.0)

# OCR/layout
OCR_API_URL = _env("OCR_API_URL", "http://192.168.20.156:8088/v1/ocr")
OCR_MODEL_NAME = _env("OCR_MODEL_NAME", "mistral-ocr-latest")
OCR_INCLUDE_IMAGE_BASE64 = _env("OCR_INCLUDE_IMAGE_BASE64", "false")
OCR_TIMEOUT_SECONDS = _env_float("OCR_TIMEOUT_SECONDS", 60.0)
OCR_CENTER_TOLERANCE = _env_int("OCR_CENTER_TOLERANCE", 50)
OCR_MAX_WORKERS = _env_int("OCR_MAX_WORKERS", 4)
LAYOUT_MODEL_NAME = _env("LAYOUT_MODEL_NAME", "PP-DocLayout-L")
LAYOUT_VISUALIZATION_DIR = _env("LAYOUT_VISUALIZATION_DIR", "layout_viz")

# Domain defaults/validation
DEFAULT_GROUP_MAX_MEMBERS = _env_int("DEFAULT_GROUP_MAX_MEMBERS", 25)
DEFAULT_GROUP_AVATAR_KEY = _env("DEFAULT_GROUP_AVATAR_KEY", "avatar_1")
USERNAME_MIN_LENGTH = _env_int("USERNAME_MIN_LENGTH", 3)
USERNAME_MAX_LENGTH = _env_int("USERNAME_MAX_LENGTH", 20)
GROUP_NAME_MAX_LENGTH = _env_int("GROUP_NAME_MAX_LENGTH", 100)
GROUP_DESCRIPTION_MAX_LENGTH = _env_int("GROUP_DESCRIPTION_MAX_LENGTH", 500)
PASSWORD_MIN_LENGTH = _env_int("PASSWORD_MIN_LENGTH", 6)
USERNAME_REGEX = _env("USERNAME_REGEX", r"^[a-zA-Z0-9_]+$")
SIGNUP_EMAIL_REGEX = _env("SIGNUP_EMAIL_REGEX", r"^[a-zA-Z0-9._%+-]+@gmail\.com$")
EMAIL_REGEX = _env("EMAIL_REGEX", r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
PASSWORD_REGEX = _env("PASSWORD_REGEX", r"^(?=.*[A-Z])(?=.*\d).{6,}$")
PASSWORD_UPPERCASE_REGEX = _env("PASSWORD_UPPERCASE_REGEX", r"[A-Z]")
PASSWORD_NUMBER_REGEX = _env("PASSWORD_NUMBER_REGEX", r"[0-9]")
USER_ROLES = tuple(_env_list("USER_ROLES", ["teacher", "student"]))
GROUP_MEMBER_ROLES = tuple(_env_list("GROUP_MEMBER_ROLES", ["admin", "member"]))
GROUP_SHARED_ITEM_TYPES = tuple(
    _env_list("GROUP_SHARED_ITEM_TYPES", ["document", "flashcard"])
)
