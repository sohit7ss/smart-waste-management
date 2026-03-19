from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
import os
from dotenv import load_dotenv

load_dotenv()

RATE_LIMIT = os.getenv("RATE_LIMIT", "100/minute")

limiter = Limiter(key_func=get_remote_address, default_limits=[RATE_LIMIT])
