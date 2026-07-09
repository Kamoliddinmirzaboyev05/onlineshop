from app.core.security import create_access_token, hash_password
from app.models import AdminUser, Business, Restaurant
from app.models.enums import AdminRole


def _superadmin_token(db_session) -> str:
    business = Business(name="Biznes", username="admwrite_biz", hashed_password="x")
    db_session.add(business)
    db_session.commit()
    restaurant = Restaurant(name="Do'kon", business_id=business.id)
    db_session.add(restaurant)
    db_session.commit()
    admin = AdminUser(
        username="admwrite_super", hashed_password=hash_password("pw"),
        role=AdminRole.superadmin, restaurant_id=restaurant.id,
    )
    db_session.add(admin)
    db_session.commit()
    return create_access_token(subject=str(admin.id), role=AdminRole.superadmin.value)


def test_create_admin_user_sets_restaurant_id_from_creator(client, db_session):
    token = _superadmin_token(db_session)
    resp = client.post(
        "/api/admin/admin-users",
        json={"username": "new_courier", "password": "pw12345", "role": "courier"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    created = db_session.query(AdminUser).filter_by(username="new_courier").one()
    assert created.restaurant_id is not None
