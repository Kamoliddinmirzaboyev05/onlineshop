import pytest
from fastapi import HTTPException

from app.models import Business, Restaurant


def test_staff_gets_own_restaurant_ignoring_query_param(db_session, tenant_a, tenant_b):
    from app.api.deps import current_restaurant, get_current_staff_or_business

    principal = get_current_staff_or_business(
        authorization=f"Bearer {tenant_a.staff_token}", db=db_session
    )
    # Staff asks for tenant B's store; must still get their own (A's).
    result = current_restaurant(
        restaurant_id=tenant_b.restaurant_id, principal=principal, db=db_session
    )
    assert result.id == tenant_a.restaurant_id


def test_business_gets_own_restaurant(db_session, tenant_a):
    from app.api.deps import current_restaurant, get_current_staff_or_business

    principal = get_current_staff_or_business(
        authorization=f"Bearer {tenant_a.business_token}", db=db_session
    )
    result = current_restaurant(
        restaurant_id=tenant_a.restaurant_id, principal=principal, db=db_session
    )
    assert result.id == tenant_a.restaurant_id


def test_business_cannot_reach_other_businesss_store(db_session, tenant_a, tenant_b):
    from app.api.deps import current_restaurant, get_current_staff_or_business

    principal = get_current_staff_or_business(
        authorization=f"Bearer {tenant_a.business_token}", db=db_session
    )
    with pytest.raises(HTTPException) as exc:
        current_restaurant(
            restaurant_id=tenant_b.restaurant_id, principal=principal, db=db_session
        )
    assert exc.value.status_code == 403


def test_business_must_supply_restaurant_id(db_session, tenant_a):
    from app.api.deps import current_restaurant, get_current_staff_or_business

    principal = get_current_staff_or_business(
        authorization=f"Bearer {tenant_a.business_token}", db=db_session
    )
    with pytest.raises(HTTPException) as exc:
        current_restaurant(restaurant_id=None, principal=principal, db=db_session)
    assert exc.value.status_code == 400


def test_courier_token_rejected_by_staff_or_business(db_session, tenant_a):
    from app.api.deps import get_current_staff_or_business
    from app.core.security import create_access_token, hash_password
    from app.models import AdminUser
    from app.models.enums import AdminRole

    courier = AdminUser(
        username="courier_x", hashed_password=hash_password("pw"),
        role=AdminRole.courier, restaurant_id=tenant_a.restaurant_id,
    )
    db_session.add(courier)
    db_session.commit()
    token = create_access_token(subject=str(courier.id), role=AdminRole.courier.value)

    with pytest.raises(HTTPException) as exc:
        get_current_staff_or_business(authorization=f"Bearer {token}", db=db_session)
    assert exc.value.status_code == 403
