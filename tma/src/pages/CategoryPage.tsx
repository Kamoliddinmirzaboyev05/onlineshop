import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, Minus, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { Category, Product, RestaurantDetail } from "../api/types";
import CartPill from "../components/CartPill";
import { MenuSkeleton } from "../components/Skeleton";
import ErrorState from "../components/ErrorState";
import { loc, useI18n } from "../i18n";
import { money, unitLabel } from "../lib/format";
import { useCart } from "../store/cart";
import { haptic } from "../telegram";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 280, damping: 24 } },
};

export default function CategoryPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { t, lang } = useI18n();
  const [store, setStore] = useState<RestaurantDetail | null>(null);
  const [error, setError] = useState(false);
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

  const cat: Category | undefined = useMemo(
    () => store?.categories.find((c) => c.id === Number(id)),
    [store, id],
  );

  if (error) return <ErrorState onRetry={load} />;
  if (!store) return <MenuSkeleton />;

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

  return (
    <div className="min-h-full bg-tg-bg">
      {/* ── Header banner ──────────────────────────────────────── */}
      <div className="relative h-40 overflow-hidden rounded-b-3xl">
        {cat?.image_url ? (
          <img src={cat.image_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-brand to-brand-dark" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10" />

        <button
          onClick={() => nav(-1)}
          className="absolute top-3 left-3 h-10 w-10 rounded-full bg-white/25 backdrop-blur-sm flex items-center justify-center text-white active:scale-95 transition"
        >
          <ChevronLeft size={22} />
        </button>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-4 left-4 right-4 text-white text-2xl font-bold drop-shadow-md"
        >
          {cat ? loc(cat, "name", lang) : t.categories}
        </motion.h1>
      </div>

      {/* ── Subcategory sections ──────────────────────────────── */}
      <div className="px-4 py-4 pb-28">
        {(() => {
          const sections = (cat?.subcategories ?? []).filter((sc) => sc.products.length > 0);
          if (sections.length === 0) {
            return <p className="text-center text-tg-hint py-16">{t.empty_category}</p>;
          }
          return sections.map((sc) => (
            <div key={sc.id} className="mb-6 last:mb-0">
              <h2 className="font-bold text-lg mb-3">{loc(sc, "name", lang)}</h2>
              <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="grid grid-cols-2 gap-3"
              >
                {sc.products.map((p) => (
                  <motion.div key={p.id} variants={item} className="card flex flex-col">
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
                      <div className="mt-auto pt-2 flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm">
                          {money(p.price)} {t.sum}
                          {p.unit ? <span className="text-tg-hint font-normal">/{unitLabel(p.unit, lang)}</span> : null}
                        </span>
                        <AnimatePresence mode="wait" initial={false}>
                          {qtyOf(p) === 0 ? (
                            <motion.button
                              key="add"
                              initial={{ scale: 0.6, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0.6, opacity: 0 }}
                              whileTap={{ scale: 0.85 }}
                              onClick={() => add(p)}
                              className="h-8 w-8 shrink-0 rounded-full bg-brand text-white flex items-center justify-center shadow-sm"
                            >
                              <Plus size={18} />
                            </motion.button>
                          ) : (
                            <motion.div
                              key="step"
                              initial={{ scale: 0.6, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0.6, opacity: 0 }}
                              className="flex items-center gap-1 shrink-0 rounded-full bg-brand-light"
                            >
                              <button
                                onClick={() => dec(p)}
                                className="h-8 w-8 rounded-full text-brand flex items-center justify-center active:scale-90 transition"
                              >
                                <Minus size={16} />
                              </button>
                              <span className="min-w-[1.25rem] text-center text-sm font-bold text-brand">
                                {qtyOf(p)}
                              </span>
                              <button
                                onClick={() => add(p)}
                                className="h-8 w-8 rounded-full bg-brand text-white flex items-center justify-center active:scale-90 transition shadow-sm"
                              >
                                <Plus size={16} />
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          ));
        })()}
      </div>

      <CartPill />
    </div>
  );
}
