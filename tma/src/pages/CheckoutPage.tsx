import { ChevronRight, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import PageHeader from "../components/PageHeader";
import { useI18n } from "../i18n";
import { formatUzPhone, money } from "../lib/format";
import { useAuth } from "../store/auth";
import { useCart } from "../store/cart";
import { useCheckoutDraft } from "../store/checkoutDraft";
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

  const { phone, comment, loc, address, setPhone, setComment, reset: resetDraft } = useCheckoutDraft();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Qoralamada telefon hali bo'sh bo'lsa, profildagi raqam bilan to'ldiramiz.
  useEffect(() => {
    if (!phone && user?.phone) setPhone(formatUzPhone(user.phone));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.phone]);

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
      resetDraft();
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

      <div className="p-4 space-y-5 bg-white">
        <button
          onClick={() => nav("/checkout/location")}
          className="w-full flex items-center gap-4 bg-[#F4F5F7] rounded-[20px] p-3 text-left active:scale-[0.98] transition"
        >
          <div className="h-[50px] w-[50px] shrink-0 rounded-[16px] bg-[#FFF0E5] flex items-center justify-center text-[#FF6B00]">
            <MapPin size={24} fill="currentColor" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold text-slate-900 leading-tight mb-1">
              {lang === "uz" ? "Yetkazib berish manzili" : "Адрес доставки"}
            </p>
            <p className="text-[13px] text-slate-400 truncate">
              {address || (lang === "uz" ? "Manzilni belgilash uchun bosing" : "Нажмите, чтобы указать адрес")}
            </p>
          </div>
          <ChevronRight size={20} className="text-slate-400 shrink-0 mr-1" />
        </button>

        <div className="space-y-2">
          <label className="text-[13px] text-slate-400 font-medium px-1">{t.phone}</label>
          <input
            value={phone}
            onChange={(e) => setPhone(formatUzPhone(e.target.value))}
            inputMode="tel"
            placeholder="+998 88 888 88 88"
            className="w-full rounded-[16px] bg-[#F4F5F7] text-[16px] text-slate-900 font-medium px-4 py-4 outline-none"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[13px] text-slate-400 font-medium px-1">{t.comment}</label>
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full rounded-[16px] bg-[#F4F5F7] text-[16px] text-slate-900 font-medium px-4 py-4 outline-none"
          />
        </div>

        <div className="flex justify-between items-center font-extrabold text-[20px] text-slate-900 mt-8 mb-4 px-1">
          <span>{lang === "uz" ? "Jami" : "Итого"}</span>
          <span>{money(cart.total())} {t.sum}</span>
        </div>

        {error && <p className="text-rose-500 text-sm font-medium px-1 mb-2">{error}</p>}

        <button onClick={submit} disabled={submitting} className="w-full bg-[#FF6B00] text-white font-bold text-[17px] py-4 rounded-[16px] active:scale-[0.98] transition disabled:opacity-60 shadow-[0_4px_12px_rgba(255,107,0,0.3)]">
          {submitting ? "…" : (lang === "uz" ? "Buyurtma berish" : "Заказать")}
        </button>
      </div>
    </div>
  );
}
