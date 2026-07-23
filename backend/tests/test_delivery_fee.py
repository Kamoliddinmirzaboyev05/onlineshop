"""Yetkazish haqi: 50k+ bepul, kam bo'lsa ceil(km)*2000."""

from app.services.orders import (
    DEFAULT_DELIVERY_PER_KM,
    DEFAULT_FREE_DELIVERY_FROM,
    calc_delivery_fee,
)


def test_free_when_items_at_or_above_threshold():
    assert calc_delivery_fee(50_000, 12.3, 50_000, 2000) == 0
    assert calc_delivery_fee(80_000, 3.0, 50_000, 2000) == 0


def test_per_km_when_below_threshold():
    # 3.1 km → ceil 4 * 2000
    assert calc_delivery_fee(10_000, 3.1, 50_000, 2000) == 8_000
    assert calc_delivery_fee(49_999, 1.0, 50_000, 2000) == 2_000
    assert calc_delivery_fee(1, 0.1, 50_000, 2000) == 2_000


def test_missing_distance_charges_one_km():
    assert calc_delivery_fee(10_000, None, 50_000, 2000) == 2000
    assert calc_delivery_fee(10_000, 0, 50_000, 2000) == 2000


def test_zero_store_settings_use_defaults():
    fee = calc_delivery_fee(10_000, 2.0, 0, 0)
    assert fee == int(2 * DEFAULT_DELIVERY_PER_KM)
    assert calc_delivery_fee(DEFAULT_FREE_DELIVERY_FROM, 5.0, 0, 0) == 0
