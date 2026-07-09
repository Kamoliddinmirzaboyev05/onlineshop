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
    """Eng kichik haqiqiy PNG (magic-byte tekshiruvidan o'tishi uchun)."""
    return bytes.fromhex(
        "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
        "0000000a49444154789c6360000002000100ffff03000006000557bfabd4000000"
        "0049454e44ae426082"
    )


def _upload(client, token: str):
    return client.post(
        "/api/admin/upload",
        files={"file": ("a.png", io.BytesIO(_png()), "image/png")},
        headers=auth(token),
    )


def test_platform_admin_can_upload(client, platform_token):
    assert _upload(client, platform_token).status_code == 200


def test_business_can_upload(client, tenant_a):
    assert _upload(client, tenant_a.business_token).status_code == 200


def test_staff_can_upload(client, tenant_a):
    assert _upload(client, tenant_a.staff_token).status_code == 200


def test_anonymous_cannot_upload(client):
    resp = client.post(
        "/api/admin/upload", files={"file": ("a.png", io.BytesIO(_png()), "image/png")}
    )
    assert resp.status_code == 401
