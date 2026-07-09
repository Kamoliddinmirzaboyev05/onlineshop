import pytest

from app.core.security import create_access_token, hash_password
from app.models import PlatformAdmin
from tests.conftest import auth, make_order


@pytest.fixture
def platform_token(db_session) -> str:
    admin = PlatformAdmin(username="plat_users", hashed_password=hash_password("pw"))
    db_session.add(admin)
    db_session.commit()
    return create_access_token(subject=str(admin.id), role="platform_superadmin")


def test_platform_users_lists_every_customer(client, db_session, platform_token, tenant_a, tenant_b):
    """Do'kon xodimining /admin/users'idan farqli — bu butun platformani ko'radi."""
    order_a = make_order(db_session, tenant_a, total=5_000)
    order_b = make_order(db_session, tenant_b, total=7_000)

    resp = client.get("/api/platform/users", headers=auth(platform_token))
    assert resp.status_code == 200
    ids = {u["id"] for u in resp.json()}
    assert {order_a.user_id, order_b.user_id} <= ids


def test_platform_users_rejects_business_token(client, tenant_a):
    resp = client.get("/api/platform/users", headers=auth(tenant_a.business_token))
    assert resp.status_code == 401


def test_platform_users_reflects_block_state(client, db_session, platform_token, tenant_a):
    order = make_order(db_session, tenant_a, total=5_000)
    client.patch(
        f"/api/platform/users/{order.user_id}/block",
        json={"blocked": True},
        headers=auth(platform_token),
    )

    resp = client.get("/api/platform/users", headers=auth(platform_token))
    blocked = [u for u in resp.json() if u["id"] == order.user_id]
    assert blocked and blocked[0]["is_blocked"] is True
