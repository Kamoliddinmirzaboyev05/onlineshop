import { motion } from "framer-motion";
import { ChevronRight, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, OutOfRangeError } from "../api/client";
import type { Category, RestaurantDetail } from "../api/types";
import CartPill from "../components/CartPill";
import { StoreListSkeleton } from "../components/Skeleton";
import ErrorState from "../components/ErrorState";
import PageHeader from "../components/PageHeader";
import { loc, useI18n } from "../i18n";
import { haptic } from "../telegram";

// Kartochka foni bo'sh bo'lganda — Title guruhi bo'yicha barqaror pastel rang.
const PALETTES = [
  "bg-[#DCF2E3]",
  "bg-[#DCEAFB]",
  "bg-[#FBE9D0]",
  "bg-[#F7DEE6]",
  "bg-[#E6E0FB]",
  "bg-[#FDF0C4]",
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

  const productCount = (c: Category) =>
    c.subcategories.reduce((sum, sc) => sum + sc.products.length, 0);

  const open = (c: Category) => {
    haptic("light");
    nav(`/category/${c.id}`);
  };

  // Kategoriyalarni Title (group_id) bo'yicha bo'laklarga ajratamiz. Title'i
  // yo'q kategoriyalar sarlavhasiz, ro'yxat oxirida ko'rsatiladi.
  const groups = store?.category_groups ?? [];
  const categories = store?.categories ?? [];
  const sections = [
    ...groups.map((g) => ({
      key: `g${g.id}`,
      title: loc(g, "name", lang),
      cats: categories.filter((c) => c.group_id === g.id),
    })),
    {
      key: "ungrouped",
      title: null as string | null,
      cats: categories.filter((c) => !groups.some((g) => g.id === c.group_id)),
    },
  ].filter((s) => s.cats.length > 0);

  return (
    <div className="min-h-full bg-tg-bg pb-16">
      <PageHeader title="AllFoods" />

      <div className="px-3 pb-4 pt-4">
        {outOfRange ? (
          <p className="text-center text-tg-hint py-16 px-4">{t.out_of_range}</p>
        ) : error ? (
          <ErrorState onRetry={load} />
        ) : loading ? (
          <StoreListSkeleton />
        ) : sections.length === 0 ? (
          <p className="text-center text-tg-hint py-16">{t.no_categories}</p>
        ) : (
          sections.map((section, si) => (
            <div key={section.key} className="mb-6 last:mb-0">
              {section.title && <h2 className="text-xl font-extrabold px-1 mb-4 text-slate-800">{section.title}</h2>}
              <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 gap-3">
                {section.cats.map((c) => (
                  <motion.button
                    key={c.id}
                    variants={card}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => open(c)}
                    className={`relative h-40 rounded-3xl overflow-hidden text-left p-4 flex flex-col ${PALETTES[si % PALETTES.length]}`}
                  >
                    <h3 className="font-bold text-slate-900 text-[17px] leading-tight z-10 w-[80%]">
                      {loc(c, "name", lang)}
                    </h3>
                    {c.image_url ? (
                      <img
                        src={c.image_url}
                        alt=""
                        className="absolute -bottom-2 -right-2 h-28 w-28 object-contain drop-shadow-md z-0"
                      />
                    ) : (
                      <ChevronRight size={18} className="absolute bottom-4 right-4 text-slate-500/50" />
                    )}
                  </motion.button>
                ))}
              </motion.div>
            </div>
          ))
        )}
      </div>

      <CartPill />
    </div>
  );
}
