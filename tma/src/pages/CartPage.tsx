import { Minus, Plus, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { loc, useI18n } from "../i18n";
import { money, unitLabel } from "../lib/format";
import { useCart } from "../store/cart";
import { haptic } from "../telegram";

export default function CartPage() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const cart = useCart();
  const lines = Object.values(cart.lines);

  if (lines.length === 0) {
    return (
      <div className="min-h-full bg-tg-bg">
        <PageHeader title={t.cart} />
        <div className="p-10 text-center text-tg-hint">
          <div className="text-5xl mb-3">🛒</div>
          {t.cart_empty}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-tg-bg pb-36">
      <PageHeader title={t.cart} subtitle={`${cart.count()} ${t.products_n}`} />

      <div className="px-4 divide-y divide-black/5">
        {lines.map(({ product, quantity }) => (
          <div key={product.id} className="flex items-start gap-3 py-4">
            <div className="h-16 w-16 shrink-0 rounded-2xl bg-tg-card flex items-center justify-center overflow-hidden text-2xl">
              {product.image_url ? (
                <img src={product.image_url} alt="" className="h-full w-full object-cover" />
              ) : (
                "🛒"
              )}
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium leading-tight line-clamp-1">{loc(product, "name", lang)}</h3>
                <button
                  onClick={() => {
                    cart.remove(product.id);
                    haptic("light");
                  }}
                  className="shrink-0 text-tg-hint/70 active:scale-90 transition"
                >
                  <Trash2 size={17} />
                </button>
              </div>
              <p className="text-sm text-tg-hint mt-1">
                1{product.unit ? unitLabel(product.unit, lang) : ""}
              </p>
              <div className="flex items-center justify-between gap-2 mt-1.5">
                <span className="font-bold text-lg">{money(product.price * quantity)}</span>
                <div className="flex items-center gap-1 rounded-full bg-tg-card px-1 py-1">
                  <button
                    onClick={() => cart.setQty(product.id, quantity - 1)}
                    className="h-7 w-7 rounded-full flex items-center justify-center active:scale-90 transition"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="min-w-[3rem] text-center text-sm font-bold">
                    {quantity}{product.unit ? unitLabel(product.unit, lang) : ""}
                  </span>
                  <button
                    onClick={() => cart.setQty(product.id, quantity + 1)}
                    className="h-7 w-7 rounded-full bg-brand text-white flex items-center justify-center active:scale-90 transition"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="fixed bottom-16 inset-x-0 bg-tg-bg border-t border-black/5 px-4 py-3 flex items-center justify-between gap-3 rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        <button
          onClick={() => {
            cart.clear();
            haptic("light");
          }}
          className="text-sm font-medium text-rose-500 shrink-0"
        >
          {t.clear_cart}
        </button>
        <div className="text-right">
          <p className="text-xs text-tg-hint leading-none mb-1">{t.products_n}</p>
          <p className="font-bold text-lg leading-none">{money(cart.total())} {t.sum}</p>
        </div>
        <button
          onClick={() => nav("/checkout")}
          className="shrink-0 flex items-center gap-2 bg-slate-900 text-white font-semibold rounded-full pl-5 pr-4 py-3 active:scale-95 transition"
        >
          {t.place_order}
          <span aria-hidden>→</span>
        </button>
      </div>
    </div>
  );
}
