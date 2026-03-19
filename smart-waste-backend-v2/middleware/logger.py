import logging
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
import time

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("smart_waste")

class AuditLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        client_ip = request.client.host
        method = request.method
        url = request.url.path
        
        response = await call_next(request)
        process_time = time.time() - start_time
        
        logger.info(f"{client_ip} - {method} {url} - {response.status_code} - {process_time:.4f}s")
        return response
