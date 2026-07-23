"""Rasm yuklash uchalasiga ham ochiq bo'lishi kerak: do'kon xodimi (mahsulot rasmi),
tadbirkor (mahsulot rasmi), platform admin (e'lon rasmi)."""

import io

import pytest

from app.core.security import create_access_token, hash_password
from app.models import PlatformAdmin
from tests.conftest import auth


@pytest.fixture
def platform_token(db_session) -> str:
    admin = PlatformAdmin(username="plat_upload", hashed_password=hash_password("pw"))
    db_session.add(admin)
    db_session.commit()
    return create_access_token(subject=str(admin.id), role="platform_superadmin")


def _png() -> bytes:
    """Haqiqiy PNG (Pillow + magic-byte)."""
    from io import BytesIO

    from PIL import Image

    buf = BytesIO()
    Image.new("RGB", (32, 32), (255, 80, 40)).save(buf, format="PNG")
    return buf.getvalue()


def _upload(client, token: str):
    return client.post(
        "/api/admin/upload",
        files={"file": ("a.png", io.BytesIO(_png()), "image/png")},
        headers=auth(token),
    )


def test_platform_admin_can_upload(client, platform_token):
    resp = _upload(client, platform_token)
    assert resp.status_code == 200
    assert resp.json()["url"].endswith(".webp")


def test_business_can_upload(client, tenant_a):
    resp = _upload(client, tenant_a.business_token)
    assert resp.status_code == 200
    assert resp.json()["url"].endswith(".webp")


def test_staff_can_upload(client, tenant_a):
    resp = _upload(client, tenant_a.staff_token)
    assert resp.status_code == 200
    assert resp.json()["url"].endswith(".webp")


def test_anonymous_cannot_upload(client):
    resp = client.post(
        "/api/admin/upload", files={"file": ("a.png", io.BytesIO(_png()), "image/png")}
    )
    assert resp.status_code == 401
