import os
import re
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from dotenv import load_dotenv

load_dotenv()

MAX_REQUEST_SIZE = int(os.getenv("MAX_REQUEST_SIZE_MB", "5")) * 1024 * 1024  # Convert MB to bytes
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png"}


class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    """Reject requests larger than MAX_REQUEST_SIZE_MB."""
    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > MAX_REQUEST_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"Request too large. Maximum allowed size is {MAX_REQUEST_SIZE // (1024*1024)}MB."
            )
        return await call_next(request)


def validate_image_file(filename: str) -> bool:
    """Check if filename has an allowed image extension."""
    if not filename:
        return False
    ext = os.path.splitext(filename)[1].lower()
    return ext in ALLOWED_IMAGE_EXTENSIONS


def sanitize_string(text: str) -> str:
    """Basic input sanitization — strip HTML tags and dangerous characters."""
    if not text:
        return text
    # Remove HTML tags
    clean = re.sub(r'<[^>]+>', '', text)
    # Remove potentially dangerous characters
    clean = clean.replace('\x00', '')
    return clean.strip()
