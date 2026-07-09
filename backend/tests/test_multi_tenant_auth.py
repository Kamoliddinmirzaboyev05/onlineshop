import pytest
from fastapi import HTTPException

from app.core.security import create_access_token, hash_password
from app.models import Business, PlatformAdmin


def test_get_current_business_accepts_valid_token(db_session):
    from app.api.deps import get_current_business

    business = Business(
        name="Biznes", username="biz3", hashed_password=hash_password("pw"),
    )
    db_session.add(business)
    db_session.commit()

    token = create_access_token(subject=str(business.id), role="businessman")
    result = get_current_business(authorization=f"Bearer {token}", db=db_session)
    assert result.id == business.id


def test_get_current_business_rejects_wrong_role(db_session):
    from app.api.deps import get_current_business

    token = create_access_token(subject="1", role="platform_superadmin")
    with pytest.raises(HTTPException):
        get_current_business(authorization=f"Bearer {token}", db=db_session)


def test_get_current_platform_admin_accepts_valid_token(db_session):
    from app.api.deps import get_current_platform_admin

    admin = PlatformAdmin(username="plat1", hashed_password=hash_password("pw"))
    db_session.add(admin)
    db_session.commit()

    token = create_access_token(subject=str(admin.id), role="platform_superadmin")
    result = get_current_platform_admin(authorization=f"Bearer {token}", db=db_session)
    assert result.id == admin.id


def test_get_current_platform_admin_rejects_wrong_role(db_session):
    from app.api.deps import get_current_platform_admin

    token = create_access_token(subject="1", role="businessman")
    with pytest.raises(HTTPException):
        get_current_platform_admin(authorization=f"Bearer {token}", db=db_session)


def test_business_login_and_me(client, db_session):
    business = Business(
        name="Biznes Login", username="bizlogin", hashed_password=hash_password("secret123"),
    )
    db_session.add(business)
    db_session.commit()

    resp = client.post("/api/business/auth/login", json={"username": "bizlogin", "password": "secret123"})
    assert resp.status_code == 200
    token = resp.json()["access_token"]

    me = client.get("/api/business/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["username"] == "bizlogin"


def test_business_login_rejects_wrong_password(client, db_session):
    business = Business(
        name="Biznes Login2", username="bizlogin2", hashed_password=hash_password("secret123"),
    )
    db_session.add(business)
    db_session.commit()

    resp = client.post("/api/business/auth/login", json={"username": "bizlogin2", "password": "wrong"})
    assert resp.status_code == 401


def test_platform_login_and_me(client, db_session):
    admin = PlatformAdmin(username="platlogin", hashed_password=hash_password("secret123"))
    db_session.add(admin)
    db_session.commit()

    resp = client.post("/api/platform/auth/login", json={"username": "platlogin", "password": "secret123"})
    assert resp.status_code == 200
    token = resp.json()["access_token"]

    me = client.get("/api/platform/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["username"] == "platlogin"


def test_business_login_rejects_inactive(client, db_session):
    business = Business(
        name="Biznes Inactive", username="bizinactive", hashed_password=hash_password("secret123"),
        is_active=False,
    )
    db_session.add(business)
    db_session.commit()

    resp = client.post("/api/business/auth/login", json={"username": "bizinactive", "password": "secret123"})
    assert resp.status_code == 401


def test_platform_login_rejects_inactive(client, db_session):
    admin = PlatformAdmin(
        username="platinactive", hashed_password=hash_password("secret123"), is_active=False,
    )
    db_session.add(admin)
    db_session.commit()

    resp = client.post("/api/platform/auth/login", json={"username": "platinactive", "password": "secret123"})
    assert resp.status_code == 401


def test_business_token_rejected_by_platform_me(client, db_session):
    business = Business(
        name="Biznes Cross", username="bizcross", hashed_password=hash_password("secret123"),
    )
    db_session.add(business)
    db_session.commit()

    resp = client.post("/api/business/auth/login", json={"username": "bizcross", "password": "secret123"})
    token = resp.json()["access_token"]

    me = client.get("/api/platform/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 401


def test_platform_token_rejected_by_business_me(client, db_session):
    admin = PlatformAdmin(username="platcross", hashed_password=hash_password("secret123"))
    db_session.add(admin)
    db_session.commit()

    resp = client.post("/api/platform/auth/login", json={"username": "platcross", "password": "secret123"})
    token = resp.json()["access_token"]

    me = client.get("/api/business/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 401
