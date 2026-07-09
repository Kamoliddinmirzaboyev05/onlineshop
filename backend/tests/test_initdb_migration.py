from sqlalchemy import text


def test_initdb_is_idempotent_and_creates_default_business(engine):
    from app.initdb import main as initdb_main

    initdb_main(engine=engine)
    initdb_main(engine=engine)  # second run must not error (idempotent)

    with engine.connect() as conn:
        business_count = conn.execute(text("SELECT COUNT(*) FROM businesses")).scalar()
        assert business_count >= 1


def _fk_delete_rule(conn, table_name: str, column_name: str) -> str:
    return conn.execute(
        text(
            "SELECT rc.delete_rule FROM information_schema.referential_constraints rc "
            "JOIN information_schema.key_column_usage kcu "
            "  ON rc.constraint_name = kcu.constraint_name "
            "WHERE kcu.table_name = :t AND kcu.column_name = :c"
        ),
        {"t": table_name, "c": column_name},
    ).scalar_one()


def test_initdb_retrofits_legacy_rows_missing_tenant_columns(engine):
    """Simulates a real production DB: a Restaurant/AdminUser row that predates
    the business_id/restaurant_id columns. initdb must add the columns back,
    backfill the legacy rows (not leave them NULL), enforce NOT NULL, and use
    the same ON DELETE CASCADE the ORM models declare."""
    from app.initdb import main as initdb_main

    initdb_main(engine=engine)  # ensure a default business/schema already exist

    with engine.begin() as conn:
        # Drop back to "legacy" shape (DROP COLUMN also drops the dependent FK).
        conn.execute(text("ALTER TABLE admin_users DROP COLUMN IF EXISTS restaurant_id"))
        conn.execute(text("ALTER TABLE restaurants DROP COLUMN IF EXISTS business_id"))
        legacy_restaurant_id = conn.execute(
            text(
                "INSERT INTO restaurants "
                "(name, is_active, rating, delivery_fee, min_order, avg_delivery_minutes, is_open) "
                "VALUES ('Legacy Do''kon', TRUE, 0.0, 0, 0, 40, TRUE) RETURNING id"
            )
        ).scalar_one()
        legacy_admin_id = conn.execute(
            text(
                "INSERT INTO admin_users (username, hashed_password, role, is_active) "
                "VALUES ('legacy_admin', 'x', 'manager', TRUE) RETURNING id"
            )
        ).scalar_one()

    try:
        initdb_main(engine=engine)  # the retrofit must run against the legacy rows

        with engine.connect() as conn:
            restaurant_business_id = conn.execute(
                text("SELECT business_id FROM restaurants WHERE id = :id"),
                {"id": legacy_restaurant_id},
            ).scalar_one()
            assert restaurant_business_id is not None

            admin_restaurant_id = conn.execute(
                text("SELECT restaurant_id FROM admin_users WHERE id = :id"),
                {"id": legacy_admin_id},
            ).scalar_one()
            assert admin_restaurant_id is not None

            assert conn.execute(text(
                "SELECT is_nullable FROM information_schema.columns "
                "WHERE table_name = 'restaurants' AND column_name = 'business_id'"
            )).scalar_one() == "NO"
            assert conn.execute(text(
                "SELECT is_nullable FROM information_schema.columns "
                "WHERE table_name = 'admin_users' AND column_name = 'restaurant_id'"
            )).scalar_one() == "NO"

            # This is the check that would have caught a retrofit FK missing
            # ON DELETE CASCADE (the ORM models declare ondelete="CASCADE").
            assert _fk_delete_rule(conn, "restaurants", "business_id") == "CASCADE"
            assert _fk_delete_rule(conn, "admin_users", "restaurant_id") == "CASCADE"
    finally:
        # Leave restaurants/admin_users empty again — other tests assume that.
        with engine.begin() as conn:
            conn.execute(text("DELETE FROM admin_users WHERE id = :id"), {"id": legacy_admin_id})
            conn.execute(text("DELETE FROM restaurants WHERE id = :id"), {"id": legacy_restaurant_id})
