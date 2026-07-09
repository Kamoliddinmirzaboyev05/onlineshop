import pytest

from app.core.security import create_access_token, hash_password
from app.models import PlatformAdmin
from tests.conftest import auth, make_order


@pytest.fixture
def platform_token(db_session) -> str:
    admin = PlatformAdmin(username="plat_stats", hashed_password=hash_password("pw"))
    db_session.add(admin)
    db_session.commit()
    return create_access_token(subject=str(admin.id), role="platform_superadmin")


def test_platform_stats_counts_everything(client, db_session, platform_token, tenant_a, tenant_b):
    make_order(db_session, tenant_a, total=5_000)
    make_order(db_session, tenant_b, total=7_000)

    resp = client.get("/api/platform/stats?period=all", headers=auth(platform_token))
    assert resp.status_code == 200
    body = resp.json()

    assert body["businesses_total"] == 2
    assert body["stores_total"] == 2
    assert body["customers_total"] == 2
    assert body["total_orders"] == 2
    assert body["total_revenue"] == 12_000  # both businesses, unlike /business/stats
    assert len(body["businesses"]) == 2


def test_platform_stats_breaks_down_per_business(client, db_session, platform_token, tenant_a, tenant_b):
    make_order(db_session, tenant_a, total=5_000)

    resp = client.get("/api/platform/stats?period=all", headers=auth(platform_token))
    rows = {r["business_id"]: r for r in resp.json()["businesses"]}
    assert rows[tenant_a.business_id]["revenue"] == 5_000
    assert rows[tenant_a.business_id]["stores"] == 1
    assert rows[tenant_b.business_id]["revenue"] == 0


def test_platform_stats_rejects_bad_period(client, platform_token):
    resp = client.get("/api/platform/stats?period=decade", headers=auth(platform_token))
    assert resp.status_code == 400


def test_business_cannot_read_platform_stats(client, tenant_a):
    resp = client.get("/api/platform/stats", headers=auth(tenant_a.business_token))
    assert resp.status_code == 401
