import { motion } from "motion/react";
import { useState } from "react";
import { get } from "../api";
import PageHeader from "../components/PageHeader";
import { EarningsSkeleton } from "../components/Skeleton";
import { useResource } from "../lib/cache";
import { listContainer, listItem, tap } from "../lib/motion";
import { formatDay, money } from "../lib/format";
import type { EarningsOut } from "../types";

const RANGES = [
  { days: 7, label: "7 kun" },
  { days: 30, label: "30 kun" },
  { days: 90, label: "90 kun" },
];

export default function EarningsPage() {
  const [days, setDays] = useState(7);

  const { data, loading, refreshing, error, refresh } = useResource<EarningsOut>(
    `courier_earnings_${days}`,
    () => get<EarningsOut>(`/courier/earnings?days=${days}`),
    { errorText: "Daromadni yuklab bo'lmadi. Internetni tekshiring." }
  );

  const recent = [...(data?.series ?? [])].reverse().filter((d) => d.delivered > 0);

  return (
    <>
      <PageHeader title="Daromad" loading={loading || refreshing} onRefresh={refresh} />

      <div className="px-4 pt-3 flex gap-2">
        {RANGES.map((r) => (
          <motion.button
            key={r.days}
            whileTap={tap}
            onClick={() => setDays(r.days)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
              days === r.days ? "bg-brand text-white" : "bg-white border border-slate-200 text-slate-500"
            }`}
          >
            {r.label}
          </motion.button>
        ))}
      </div>

      {loading ? (
        <EarningsSkeleton />
      ) : (
        <div className="p-4 space-y-4">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>
          )}

          {/* Jami */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-5 bg-brand text-white"
          >
            <div className="text-sm opacity-90">Jami daromad</div>
            <div className="text-3xl font-bold mt-1">{money(data?.total_earnings ?? 0)} so'm</div>
            <div className="text-sm opacity-90 mt-1">
              {data?.total_delivered ?? 0} ta buyurtma yetkazildi
            </div>
          </motion.div>

          {/* Kunlik ro'yxat */}
          <div className="card divide-y divide-slate-100">
            {recent.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-sm">Bu davrda daromad yo'q</div>
            )}
            <motion.div variants={listContainer} initial="initial" animate="animate" key={days}>
              {recent.map((d) => (
                <motion.div
                  key={d.date}
                  variants={listItem}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div>
                    <div className="text-sm font-medium">{formatDay(d.date)}</div>
                    <div className="text-xs text-slate-400">{d.delivered} ta yetkazildi</div>
                  </div>
                  <div className="font-bold text-brand">{money(d.earnings)} so'm</div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      )}
    </>
  );
}
