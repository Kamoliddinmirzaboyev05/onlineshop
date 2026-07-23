"""Status xabarlari bitta tilda va kuryer ma'lumoti bilan."""

from app.services.notify import build_status_message


def test_accepted_uz_includes_courier_not_russian():
    msg = build_status_message(
        "accepted", "AF-TEST", lang="uz",
        courier_name="Ali", courier_phone="+998901112233",
    )
    assert "Kuryer buyurtmani qabul qildi" in msg
    assert "Ali" in msg
    assert "+998901112233" in msg
    assert "Курьер" not in msg
    assert "принят" not in msg.lower() and "принял" not in msg


def test_accepted_ru_only():
    msg = build_status_message(
        "accepted", "AF-TEST", lang="ru",
        courier_name="Ali", courier_phone="+99890",
    )
    assert "Курьер принял заказ" in msg
    assert "Ali" in msg
    assert "qabul qildi" not in msg


def test_delivered_no_mixed_language():
    uz = build_status_message("delivered", "AF-1", lang="uz")
    ru = build_status_message("delivered", "AF-1", lang="ru")
    assert "yetkazib berildi" in uz
    assert "доставлен" in ru
    assert "Доставлен" not in uz
    assert "yetkazib" not in ru
