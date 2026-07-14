import { ChevronRight, MapPin } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import LocationConfirmSheet from "../components/LocationConfirmSheet";
import PageHeader from "../components/PageHeader";
import { useI18n } from "../i18n";
import { formatUzPhone, money } from "../lib/format";
import { useAuth } from "../store/auth";
import { useCart } from "../store/cart";
import { haptic } from "../telegram";

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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lines = Object.values(cart.lines);

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
      setError(lang === "uz" ? "Yetkazib berish manzilini belgilang" : "Укажите адрес доставки");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
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
    <div className="min-h-full bg-tg-bg pb-8">
      <PageHeader title={t.checkout} back />

      <div className="p-4 space-y-4">
        <button
          onClick={() => setPickerOpen(true)}
          className="w-full flex items-center gap-3 card p-3.5 text-left"
        >
          <span className="h-10 w-10 shrink-0 rounded-xl bg-brand-light flex items-center justify-center text-brand">
            <MapPin size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{lang === "uz" ? "Yetkazib berish manzili" : "Адрес доставки"}</p>
            <p className="text-xs text-tg-hint truncate mt-0.5">
              {address || (lang === "uz" ? "Manzilni belgilash uchun bosing" : "Нажмите, чтобы указать адрес")}
            </p>
          </div>
          <ChevronRight size={18} className="text-tg-hint shrink-0" />
        </button>

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

        <div className="flex justify-between font-bold text-lg">
          <span>{t.total}</span>
          <span>{money(cart.total())} {t.sum}</span>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button onClick={submit} disabled={submitting} className="btn-brand w-full disabled:opacity-60">
          {submitting ? "…" : t.place_order}
        </button>
      </div>

      {pickerOpen && (
        <LocationConfirmSheet
          initial={loc}
          lang={lang}
          onClose={() => setPickerOpen(false)}
          onConfirm={(lat, lng, addr) => {
            setLoc({ lat, lng });
            setAddress(addr);
            setPickerOpen(false);
            haptic("light");
          }}
        />
      )}
    </div>
  );
}
