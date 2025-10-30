from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
import uuid

from .logger import set_request_id, get_logger


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Middleware para gerar e anexar um request_id em cada requisição."""

    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        set_request_id(request_id)
        response: Response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response