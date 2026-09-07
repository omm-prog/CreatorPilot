import os
from pathlib import Path
from typing import List
from dotenv import load_dotenv

# Load .env from backend directory if it exists
backend_dir = Path(__file__).resolve().parent
env_path = backend_dir / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
PARALLEL_API_KEY = os.getenv("PARALLEL_API_KEY")
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))
ENVIRONMENT = os.getenv("ENVIRONMENT", "production")

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")


def get_allowed_origins() -> List[str]:
    """Resolves allowed CORS origins from environment variable or defaults."""
    origins_env = os.getenv("ALLOWED_ORIGINS")
    if origins_env:
        if origins_env.strip() == "*":
            return ["*"]
        return [o.strip() for o in origins_env.split(",") if o.strip()]

    # Standard defaults for development and local testing
    default_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        FRONTEND_ORIGIN,
    ]
    # Remove duplicates while preserving order
    return list(dict.fromkeys(default_origins))


def is_gemini_configured() -> bool:
    """Checks if a valid Gemini API key is configured."""
    return bool(GEMINI_API_KEY and GEMINI_API_KEY.strip() and GEMINI_API_KEY != "your_gemini_api_key_here")


def is_parallel_configured() -> bool:
    """Checks if a valid Parallel API key is configured."""
    return bool(PARALLEL_API_KEY and PARALLEL_API_KEY.strip() and PARALLEL_API_KEY != "your_parallel_api_key_here")

