#!/usr/bin/env python3
"""Mavjud /uploads fayllarini joyida siqadi (URL o'zgarmaydi).

Prod serverda:
  cd backend && ./venv/bin/python scripts/reprocess_uploads.py

Katta PNG → max 1200px WebP bayt (extension saqlanadi; main.py MIME sniff qiladi).
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.services.images import process_upload, reprocess_file  # noqa: E402

UPLOAD_DIR = ROOT / "uploads"


def main() -> None:
    if not UPLOAD_DIR.is_dir():
        print("uploads yo'q:", UPLOAD_DIR)
        return
    before = sum(p.stat().st_size for p in UPLOAD_DIR.iterdir() if p.is_file())
    n = 0
    for p in sorted(UPLOAD_DIR.iterdir()):
        if not p.is_file() or p.suffix.lower() not in (".png", ".jpg", ".jpeg", ".webp", ".gif"):
            continue
        if p.stat().st_size < 200:
            continue
        # Katta fayllar: WebP (eng kichik). Kichikroq: format saqlab reprocess.
        if p.stat().st_size >= 50_000:
            try:
                out, _ = process_upload(p.read_bytes())
            except Exception as e:
                print("skip", p.name, e)
                continue
            if len(out) < p.stat().st_size:
                p.write_bytes(out)
                n += 1
                print("webp", p.name, len(out))
        elif reprocess_file(p):
            n += 1
            print("ok", p.name, p.stat().st_size)
    after = sum(p.stat().st_size for p in UPLOAD_DIR.iterdir() if p.is_file())
    print(f"done n={n} before={before} after={after} saved={before - after}")


if __name__ == "__main__":
    main()
