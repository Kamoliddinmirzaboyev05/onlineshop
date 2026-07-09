import pytest

from app.core.security import create_access_token, hash_password
from app.models import PlatformAdmin
from tests.conftest import auth


@pytest.fixture
def platform_token(db_session) -> str:
    admin = PlatformAdmin(username="plat_biz", hashed_password=hash_password("pw"))
    db_session.add(admin)
    db_session.commit()
    return create_access_token(subject=str(admin.id), role="platform_superadmin")


def test_list_businesses_includes_store_count(client, platform_token, tenant_a):
    resp = client.get("/api/platform/businesses", headers=auth(platform_token))
    assert resp.status_code == 200
    rows = resp.json()
    assert len(rows) == 1
    assert rows[0]["id"] == tenant_a.business_id
    assert rows[0]["stores_count"] == 1


def test_create_business(client, platform_token):
    resp = client.post(
        "/api/platform/businesses",
        json={"name": "Yangi biznes", "username": "yangi_biz", "password": "pw123456"},
        headers=auth(platform_token),
    )
    assert resp.status_code == 201
    assert resp.json()["username"] == "yangi_biz"
    assert "hashed_password" not in resp.json()


def test_created_business_can_log_in(client, platform_token):
    client.post(
        "/api/platform/businesses",
        json={"name": "Login biznes", "username": "login_biz", "password": "pw123456"},
        headers=auth(platform_token),
    )
    resp = client.post(
        "/api/business/auth/login", json={"username": "login_biz", "password": "pw123456"}
    )
    assert resp.status_code == 200


def test_duplicate_username_rejected(client, platform_token, tenant_a):
    resp = client.post(
        "/api/platform/businesses",
        json={"name": "Takror", "username": "biz_a", "password": "pw123456"},
        headers=auth(platform_token),
    )
    assert resp.status_code == 409


def test_toggle_business(client, platform_token, tenant_a):
    resp = client.patch(
        f"/api/platform/businesses/{tenant_a.business_id}/toggle",
        headers=auth(platform_token),
    )
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False


def test_business_with_stores_cannot_be_deleted(client, platform_token, tenant_a):
    resp = client.delete(
        f"/api/platform/businesses/{tenant_a.business_id}", headers=auth(platform_token)
    )
    assert resp.status_code == 409


def test_empty_business_can_be_deleted(client, platform_token):
    created = client.post(
        "/api/platform/businesses",
        json={"name": "Bo'sh", "username": "bosh_biz", "password": "pw123456"},
        headers=auth(platform_token),
    ).json()
    resp = client.delete(
        f"/api/platform/businesses/{created['id']}", headers=auth(platform_token)
    )
    assert resp.status_code == 204


def test_business_token_rejected(client, tenant_a):
    resp = client.get("/api/platform/businesses", headers=auth(tenant_a.business_token))
    assert resp.status_code == 401
