import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { Product, RestaurantDetail } from "../api/types";
import CartPill from "../components/CartPill";
import ErrorState from "../components/ErrorState";
import { loc, useI18n } from "../i18n";
import { money, unitLabel } from "../lib/format";
import { useCart } from "../store/cart";
import { haptic } from "../telegram";

export default function SearchPage() {
  const { t, lang } = useI18n();
  const [store, setStore] = useState<RestaurantDetail | null>(null);
  const [error, setError] = useState(false);
  const [q, setQ] = useState("");
  const cart = useCart();

  const load = () => {
    setError(false);
    api
      .store()
      .then(setStore)
      .catch(() => setError(true));
  };

  useEffect(() => {
    load();
  }, []);

  const all: Product[] = useMemo(
    () => (store?.categories ?? []).flatMap((c) => c.subcategories.flatMap((sc) => sc.products)),
    [store],
  );

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return all;
    return all.filter(
      (p) =>
        p.name_uz.toLowerCase().includes(needle) ||
        p.name_ru.toLowerCase().includes(needle),
    );
  }, [all, q]);

  const add = (p: Product) => {
    cart.add(p);
    haptic("light");
  };
  const dec = (p: Product) => {
    const q = cart.lines[p.id]?.quantity ?? 0;
    cart.setQty(p.id, q - 1);
    haptic("light");
  };
  const qtyOf = (p: Product) => cart.lines[p.id]?.quantity ?? 0;

  if (error) return <ErrorState onRetry={load} />;

  return (
    <div className="min-h-full bg-tg-bg">
      <div className="sticky top-0 z-20 px-3 pt-2 pb-2 bg-tg-bg">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-tg-hint" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.search}
            className="w-full rounded-2xl bg-tg-card pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-brand/40 transition"
          />
        </div>
      </div>

      <div className="px-3 pb-28 pt-1">
        {results.length === 0 ? (
          <p className="text-center text-tg-hint py-16">
            {q ? "🔍" : ""} {t.empty_category}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {results.map((p) => (
              <motion.div
                key={p.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="card flex flex-col"
              >
                <div className="relative h-28 bg-tg-card flex items-center justify-center text-3xl">
                  {p.image_url ? (
                    <img src={p.image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    "🛒"
                  )}
                  <div className="absolute -bottom-4 left-1/2 -translate-x-1/2">
                    <AnimatePresence mode="wait" initial={false}>
                      {qtyOf(p) === 0 ? (
                        <motion.button
                          key="add"
                          initial={{ scale: 0.6, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.6, opacity: 0 }}
                          whileTap={{ scale: 0.85 }}
                          onClick={() => add(p)}
                          className="h-9 w-9 rounded-full bg-brand text-white flex items-center justify-center shadow-md shadow-black/20"
                        >
                          <Plus size={18} />
                        </motion.button>
                      ) : (
                        <motion.div
                          key="step"
                          initial={{ scale: 0.6, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.6, opacity: 0 }}
                          className="flex items-center gap-1.5 shrink-0 rounded-full bg-tg-bg shadow-md shadow-black/15 px-1 py-1 whitespace-nowrap"
                        >
                          <button
                            onClick={() => dec(p)}
                            className="h-7 w-7 rounded-full text-tg-text flex items-center justify-center active:scale-90 transition"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="min-w-[2.5rem] text-center text-xs font-bold">
                            {qtyOf(p)} {p.unit ? unitLabel(p.unit, lang) : ""}
                          </span>
                          <button
                            onClick={() => add(p)}
                            className="h-7 w-7 rounded-full bg-brand text-white flex items-center justify-center active:scale-90 transition"
                          >
                            <Plus size={14} />
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                <div className="px-3 pt-6 pb-3">
                  <span className="font-bold text-sm">
                    {money(p.price)} {t.sum}
                  </span>
                  <h3 className="text-sm leading-tight line-clamp-1 mt-0.5">
                    {loc(p, "name", lang)}
                  </h3>
                  {p.unit && <p className="text-xs text-tg-hint mt-0.5">1{unitLabel(p.unit, lang)}</p>}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <CartPill />
    </div>
  );
}
