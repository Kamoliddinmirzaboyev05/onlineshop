import { Clock, MapPin } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { get } from "../api";
import PageHeader from "../components/PageHeader";
import { HistorySkeleton } from "../components/Skeleton";
import { useResource } from "../lib/cache";
import { listContainer, listItem, tap } from "../lib/motion";
import { formatDateTime, money, statusLabel, statusPill } from "../lib/format";
import type { Order } from "../types";

type Filter = "all" | "delivered" | "cancelled";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Hammasi" },
  { key: "delivered", label: "Yetkazilgan" },
  { key: "cancelled", label: "Bekor" },
];

export default function HistoryPage() {
  const nav = useNavigate();
  const [filter, setFilter] = useState<Filter>("all");

  const { data, loading, refreshing, error, refresh } = useResource<Order[]>(
    `courier_history_${filter}`,
    () => get<Order[]>(`/courier/history${filter === "all" ? "" : `?status=${filter}`}`),
    { errorText: "Tarixni yuklab bo'lmadi. Internetni tekshiring." }
  );
  const orders = data ?? [];

  return (
    <>
      <PageHeader title="Tarix" loading={loading || refreshing} onRefresh={refresh} />

      <div className="px-4 pt-3 flex gap-2">
        {FILTERS.map((f) => (
          <motion.button
            key={f.key}
            whileTap={tap}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
              filter === f.key ? "bg-brand text-white" : "bg-white border border-slate-200 text-slate-500"
            }`}
          >
            {f.label}
          </motion.button>
        ))}
      </div>

      {loading ? (
        <HistorySkeleton />
      ) : (
        <div className="p-4 space-y-3">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>
          )}

          {orders.length === 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="card p-10 text-center text-slate-400"
            >
              <Clock size={32} className="mx-auto mb-2 opacity-30" />
              <p>Tarix bo'sh</p>
            </motion.div>
          )}

          <motion.div
            className="space-y-3"
            variants={listContainer}
            initial="initial"
            animate="animate"
            key={filter}
          >
            {orders.map((o) => (
              <motion.button
                key={o.id}
                variants={listItem}
                whileTap={tap}
                onClick={() => nav(`/orders/${o.id}`)}
                className="w-full card p-4 text-left"
              >
                <div className="flex justify-between items-start mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">№ {o.number}</span>
                    <span className={`pill ${statusPill(o.status)}`}>{statusLabel(o.status)}</span>
                  </div>
                  <span className="font-bold text-brand">{money(o.total)} so'm</span>
                </div>
                <div className="flex items-start gap-1.5 text-sm text-slate-500 mb-1">
                  <MapPin size={14} className="shrink-0 mt-0.5 text-slate-400" />
                  <span className="line-clamp-1">{o.address_line}</span>
                </div>
                <div className="text-xs text-slate-400">{formatDateTime(o.created_at)}</div>
              </motion.button>
            ))}
          </motion.div>
        </div>
      )}
    </>
  );
}
