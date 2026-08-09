import multiprocessing
import os

bind = "0.0.0.0:8000"
worker_class = "uvicorn.workers.UvicornWorker"

# Default to (2 * CPU cores) + 1, the standard Gunicorn sizing heuristic;
# override via WEB_CONCURRENCY for environments where that's wrong (e.g. a
# CPU-limited container where you want to pin worker count explicitly).
workers = int(os.getenv("WEB_CONCURRENCY", multiprocessing.cpu_count() * 2 + 1))

# Recycle workers periodically - guards against slow memory growth over a
# long-running process outliving any single request. Jitter avoids every
# worker restarting in the same instant under load.
max_requests = 1000
max_requests_jitter = 100

graceful_timeout = 30
timeout = 60
keepalive = 5

accesslog = "-"   # stdout - container log collector picks this up
errorlog = "-"
loglevel = os.getenv("GUNICORN_LOG_LEVEL", "info")
