import { motion } from "framer-motion";
import { Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { Product, RestaurantDetail } from "../api/types";
import CartPill from "../components/CartPill";
import ErrorState from "../components/ErrorState";
import { loc, useI18n } from "../i18n";
import { money } from "../lib/format";
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
                <div className="h-28 bg-brand-light flex items-center justify-center text-3xl">
                  {p.image_url ? (
                    <img src={p.image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    "🛒"
                  )}
                </div>
                <div className="p-3 flex flex-col flex-1">
                  <h3 className="font-medium text-sm leading-tight line-clamp-2">
                    {loc(p, "name", lang)}
                  </h3>
                  <div className="mt-auto pt-2 flex items-center justify-between">
                    <span className="font-semibold text-sm">
                      {money(p.price)} {t.sum}
                    </span>
                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      onClick={() => add(p)}
                      className="h-8 w-8 rounded-full bg-brand text-white flex items-center justify-center shadow-sm"
                    >
                      <Plus size={18} />
                    </motion.button>
                  </div>
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
