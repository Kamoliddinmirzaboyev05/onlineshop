import { motion } from "framer-motion";
import { ChevronRight, Search, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, OutOfRangeError } from "../api/client";
import type { Category, RestaurantDetail } from "../api/types";
import CartPill from "../components/CartPill";
import { StoreListSkeleton } from "../components/Skeleton";
import ErrorState from "../components/ErrorState";
import { loc, useI18n } from "../i18n";
import { useCart } from "../store/cart";
import { haptic } from "../telegram";

// kartochka fonida rasm bo'lmaganda — har kategoriyaga barqaror gradient
const GRADIENTS = [
  "from-orange-400 to-rose-500",
  "from-emerald-400 to-teal-500",
  "from-amber-400 to-orange-500",
  "from-sky-400 to-indigo-500",
  "from-fuchsia-400 to-purple-500",
  "from-lime-400 to-green-500",
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};
const card = {
  hidden: { opacity: 0, y: 24, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 260, damping: 24 } },
};

export default function HomePage() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const [store, setStore] = useState<RestaurantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [outOfRange, setOutOfRange] = useState(false);
  const cart = useCart();

  const load = () => {
    setLoading(true);
    setError(false);
    setOutOfRange(false);
    api
      .store()
      .then((s) => {
        setStore(s);
        setLoading(false);
      })
      .catch((e) => {
        if (e instanceof OutOfRangeError) setOutOfRange(true);
        else setError(true);
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
  }, []);

  const cats = store?.categories ?? [];
  const title = store?.name && store.name !== "Do'kon" ? store.name : "AllFoods";

  const productCount = (c: Category) =>
    c.subcategories.reduce((sum, sc) => sum + sc.products.length, 0);

  const open = (c: Category) => {
    haptic("light");
    nav(`/category/${c.id}`);
  };

  return (
    <div className="min-h-full bg-tg-bg">
      {/* ── Sticky header: brand + search ──────────────────────── */}
      <div className="sticky top-0 z-20 bg-tg-bg px-3 pt-2 pb-3 shadow-sm shadow-black/5">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative bg-gradient-to-r from-brand to-brand-dark text-white rounded-2xl py-3.5 px-4 shadow-md shadow-brand/30"
        >
          <h1 className="text-center text-2xl font-extrabold tracking-tight">{title}</h1>
          <button
            onClick={() => nav("/cart")}
            className="absolute top-1/2 -translate-y-1/2 right-3 h-9 w-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center active:scale-90 transition"
          >
            <ShoppingBag size={18} />
            {cart.count() > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-white text-brand text-[10px] font-bold flex items-center justify-center">
                {cart.count()}
              </span>
            )}
          </button>
        </motion.div>

        <button
          onClick={() => nav("/search")}
          className="mt-2.5 w-full flex items-center gap-2 bg-tg-card rounded-xl px-3.5 py-2.5 text-tg-hint active:scale-[0.99] transition"
        >
          <Search size={18} />
          <span className="text-sm">{t.search}</span>
        </button>
      </div>

      {/* ── Category cards ─────────────────────────────────────── */}
      <div className="px-3 pb-4 pt-1">
        {outOfRange ? (
          <p className="text-center text-tg-hint py-16 px-4">{t.out_of_range}</p>
        ) : error ? (
          <ErrorState onRetry={load} />
        ) : loading ? (
          <StoreListSkeleton />
        ) : cats.length === 0 ? (
          <p className="text-center text-tg-hint py-16">{t.no_categories}</p>
        ) : (
          <>
            <h2 className="text-base font-bold px-1 mb-3 mt-1">{t.categories}</h2>
            <motion.div variants={container} initial="hidden" animate="show" className="space-y-3.5">
              {cats.map((c, i) => (
                <motion.button
                  key={c.id}
                  variants={card}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => open(c)}
                  className="relative w-full h-40 rounded-3xl overflow-hidden text-left shadow-lg shadow-black/10 ring-1 ring-black/5 group"
                >
                  {/* fon: rasm yoki gradient */}
                  {c.image_url ? (
                    <img
                      src={c.image_url}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-active:scale-110"
                    />
                  ) : (
                    <div className={`absolute inset-0 bg-gradient-to-br ${GRADIENTS[i % GRADIENTS.length]}`} />
                  )}

                  {/* qoraytiruvchi gradient — matn o'qilishi uchun */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />

                  {/* mahsulot soni */}
                  {productCount(c) > 0 && (
                    <span className="absolute top-3 left-3 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-semibold px-2.5 py-1">
                      {productCount(c)} {t.products_n}
                    </span>
                  )}

                  {/* sarlavha */}
                  <h3 className="absolute bottom-4 left-4 right-16 text-white text-2xl font-bold drop-shadow-md leading-tight">
                    {loc(c, "name", lang)}
                  </h3>

                  {/* chevron tugma */}
                  <span className="absolute top-1/2 -translate-y-1/2 right-4 h-11 w-11 rounded-full bg-white/25 backdrop-blur-sm flex items-center justify-center text-white group-active:translate-x-0.5 transition-transform">
                    <ChevronRight size={22} />
                  </span>
                </motion.button>
              ))}
            </motion.div>
          </>
        )}
      </div>

      <CartPill />
    </div>
  );
}
