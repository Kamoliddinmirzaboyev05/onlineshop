"""Oddiy Redis asosidagi TTL kesh (o'qish og'ir bo'lgan endpoint'lar uchun).

Redis ishlamasa — fail-open (DB'dan o'qiladi), ratelimit.py bilan bir xil uslub.
"""

import json
from typing import Any

from app.core.redis import redis_client


def cache_get_json(key: str) -> Any | None:
    try:
        raw = redis_client.get(key)
    except Exception:
        return None
    return json.loads(raw) if raw else None


def cache_set_json(key: str, value: Any, ttl: int) -> None:
    try:
        redis_client.set(key, json.dumps(value), ex=ttl)
    except Exception:
        pass
