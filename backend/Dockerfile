FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

EXPOSE 8000

# WEB_CONCURRENCY: gunicorn worker (process) soni — har biri o'z DB pool'i va
# event loop'iga ega, so'rovlar ko'p core bo'ylab tarqaladi (bitta uvicorn
# process'da hammasi bitta core'da serialize bo'lardi).
CMD gunicorn app.main:app -k uvicorn.workers.UvicornWorker -w ${WEB_CONCURRENCY:-4} -b 0.0.0.0:8000 --timeout 60 --access-logfile - --error-logfile -
