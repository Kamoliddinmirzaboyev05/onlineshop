import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import LocationPicker from "../components/LocationPicker";
import { useI18n } from "../i18n";
import { formatUzPhone, money } from "../lib/format";
import { useAuth } from "../store/auth";
import { useCart } from "../store/cart";
import { haptic } from "../telegram";

/** Koordinatadan o'qiladigan manzilni oladi (OpenStreetMap Nominatim). */
async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2&accept-language=uz,ru&zoom=18`
    );
    if (!r.ok) return null;
    const d = await r.json();
    if (d?.display_name) return String(d.display_name).split(", ").slice(0, 4).join(", ");
  } catch {
    /* ignore */
  }
  return null;
}

/** Backend xato matnini ({"detail": "..."}) ajratib oladi. */
function errorText(e: unknown): string {
  const raw = String(e);
  const m = raw.match(/\{.*\}/s);
  if (m) {
    try {
      const d = JSON.parse(m[0]).detail;
      if (typeof d === "string") return d;
    } catch {
      /* ignore */
    }
  }
  return raw;
}

export default function CheckoutPage() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const cart = useCart();
  const user = useAuth((s) => s.user);

  const [phone, setPhone] = useState(formatUzPhone(user?.phone ?? ""));
  const [comment, setComment] = useState("");
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState("");
  const [addrLoading, setAddrLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lines = Object.values(cart.lines);

  // Joylashuv tanlangach — manzilni avtomatik aniqlaymiz (foydalanuvchi yozmaydi).
  useEffect(() => {
    if (!loc) return;
    setAddrLoading(true);
    reverseGeocode(loc.lat, loc.lng)
      .then((a) => setAddress(a ?? `📍 ${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`))
      .finally(() => setAddrLoading(false));
  }, [loc?.lat, loc?.lng]);

  const submit = async () => {
    if (cart.restaurantId == null) {
      setError(lang === "uz" ? "Savatcha bo'sh" : "Корзина пуста");
      return;
    }
    if (phone.replace(/\D/g, "").length < 12) {
      setError(lang === "uz" ? "Telefon raqamini to'liq kiriting" : "Введите номер телефона полностью");
      return;
    }
    if (!loc) {
      setError(lang === "uz" ? "Joylashuvga ruxsat bering yoki xaritada belgilang" : "Разрешите геолокацию или отметьте на карте");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // Manzil joylashuvdan avtomatik aniqlangan; bo'sh bo'lsa server koordinatadan oladi.
      const order = await api.placeOrder({
        restaurant_id: cart.restaurantId,
        items: lines.map((l) => ({
          product_id: l.product.id,
          quantity: l.quantity,
        })),
        address_line: address || undefined,
        lat: loc.lat,
        lng: loc.lng,
        phone,
        comment,
        payment_method: "cash",
      });
      haptic("medium");
      cart.clear();
      nav(`/orders/${order.id}?placed=1`, { replace: true });
    } catch (e) {
      setError(errorText(e));
      setSubmitting(false);
    }
  };

  if (lines.length === 0) {
    return <div className="p-10 text-center text-tg-hint">{t.cart_empty}</div>;
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">{t.checkout}</h1>

      <div>
        <label className="text-sm font-medium">
          📍 {lang === "uz" ? "Yetkazib berish manzili" : "Адрес доставки"}
        </label>
        <p className="text-xs text-tg-hint mt-0.5 mb-1">
          {lang === "uz"
            ? "Joylashuvingiz avtomatik aniqlanadi. Kerak bo'lsa nuqtani xaritada suring."
            : "Геолокация определится автоматически. При необходимости передвиньте точку на карте."}
        </p>
        <LocationPicker value={loc} onChange={(lat, lng) => setLoc({ lat, lng })} />

        {/* Aniqlangan manzil — avtomatik to'ldiriladi, tahrirlash ham mumkin */}
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder={
            loc
              ? (addrLoading
                  ? (lang === "uz" ? "Manzil aniqlanmoqda…" : "Определение адреса…")
                  : t.address_ph)
              : (lang === "uz" ? "Joylashuv kutilmoqda…" : "Ожидание геолокации…")
          }
          className="w-full rounded-xl bg-tg-card px-4 py-3 outline-none mt-2"
        />
        <p className={`text-xs mt-1 ${loc ? "text-emerald-600" : "text-tg-hint"}`}>
          {loc
            ? (lang === "uz" ? "✓ Joylashuv belgilandi" : "✓ Местоположение отмечено")
            : (lang === "uz" ? "Joylashuv aniqlanmoqda…" : "Определение местоположения…")}
        </p>
      </div>

      <div>
        <label className="text-sm text-tg-hint">{t.phone}</label>
        <input
          value={phone}
          onChange={(e) => setPhone(formatUzPhone(e.target.value))}
          inputMode="tel"
          placeholder="+998 88 888 88 88"
          className="w-full rounded-xl bg-tg-card px-4 py-3 outline-none mt-1"
        />
      </div>

      <div>
        <label className="text-sm text-tg-hint">{t.comment}</label>
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="w-full rounded-xl bg-tg-card px-4 py-3 outline-none mt-1"
        />
      </div>

      <div className="flex justify-between text-tg-hint">
        <span>{t.delivery}</span>
        <span>{t.total}</span>
      </div>
      <div className="flex justify-between font-bold text-lg">
        <span>{t.total}</span>
        <span>{money(cart.total())} {t.sum}</span>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button onClick={submit} disabled={submitting} className="btn-brand w-full disabled:opacity-60">
        {submitting ? "…" : t.place_order}
      </button>
    </div>
  );
}
