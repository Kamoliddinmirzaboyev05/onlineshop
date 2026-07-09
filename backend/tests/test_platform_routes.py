import pytest

from app.core.security import create_access_token, hash_password
from app.models import PlatformAdmin
from tests.conftest import auth, make_order


@pytest.fixture
def platform_token(db_session) -> str:
    admin = PlatformAdmin(username="plat_routes", hashed_password=hash_password("pw"))
    db_session.add(admin)
    db_session.commit()
    return create_access_token(subject=str(admin.id), role="platform_superadmin")


def test_platform_admin_can_list_announcements(client, platform_token):
    resp = client.get("/api/platform/announcements", headers=auth(platform_token))
    assert resp.status_code == 200
    assert resp.json() == []


def test_business_cannot_reach_platform_announcements(client, tenant_a):
    resp = client.get("/api/platform/announcements", headers=auth(tenant_a.business_token))
    assert resp.status_code == 401


def test_staff_cannot_reach_platform_announcements(client, tenant_a):
    resp = client.get("/api/platform/announcements", headers=auth(tenant_a.staff_token))
    assert resp.status_code == 401


def test_announcements_gone_from_admin_router(client, tenant_a):
    resp = client.get(
        f"/api/admin/announcements?restaurant_id={tenant_a.restaurant_id}",
        headers=auth(tenant_a.business_token),
    )
    assert resp.status_code == 404


def test_platform_admin_can_block_user(client, db_session, platform_token, tenant_a):
    order = make_order(db_session, tenant_a, total=5_000)
    resp = client.patch(
        f"/api/platform/users/{order.user_id}/block",
        json={"blocked": True},
        headers=auth(platform_token),
    )
    assert resp.status_code == 200
    assert resp.json()["is_blocked"] is True


def test_staff_cannot_block_user(client, db_session, tenant_a):
    order = make_order(db_session, tenant_a, total=5_000)
    resp = client.patch(
        f"/api/admin/users/{order.user_id}/block",
        json={"blocked": True},
        headers=auth(tenant_a.staff_token),
    )
    assert resp.status_code == 404
