import logging
import sys
import uuid
from contextvars import ContextVar

from pythonjsonlogger import jsonlogger

# Context var para armazenar o request_id
request_id_ctx_var: ContextVar[str] = ContextVar("request_id", default="-")


class RequestIdFilter(logging.Filter):
    """Filtro que injeta o request_id no registro de log."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_ctx_var.get()
        return True


def init_logging() -> None:
    """Configura logging estruturado no formato JSON."""
    root = logging.getLogger()
    # Não configurar mais de uma vez
    if getattr(root, "_configured", False):
        return
    root.setLevel(logging.INFO)
    handler = logging.StreamHandler(sys.stdout)
    formatter = jsonlogger.JsonFormatter(
        fmt="%(asctime)s %(levelname)s %(name)s %(message)s %(request_id)s",
        datefmt="%Y-%m-%dT%H:%M:%S%z",
    )
    handler.setFormatter(formatter)
    handler.addFilter(RequestIdFilter())
    root.addHandler(handler)
    root._configured = True


def get_logger(name: str = __name__) -> logging.Logger:
    return logging.getLogger(name)


def set_request_id(request_id: str) -> None:
    request_id_ctx_var.set(request_id)