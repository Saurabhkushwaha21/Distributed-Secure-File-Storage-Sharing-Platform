from contextvars import ContextVar

# Set per-request by app.main's request_id_middleware, read by
# app.utils.logger's formatter so every log line emitted while handling a
# request carries the same X-Request-ID that's echoed back to the client -
# lets a support ticket citing one request ID be grep'd straight out of
# server logs.
request_id_ctx: ContextVar[str] = ContextVar("request_id", default="-")
