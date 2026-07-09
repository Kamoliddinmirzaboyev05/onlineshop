import { Bike, Clock, MapPin, Navigation, Phone } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { get, patch, post } from "../api";
import PageHeader from "../components/PageHeader";
import { ListSkeleton } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import { useResource } from "../lib/cache";
import { listContainer, listItem, tap } from "../lib/motion";
import { isAcceptableOrderStatus } from "../lib/orderActions";
import { distanceLabel, etaLabel, money, qtyUnit, statusLabel, statusPill } from "../lib/format";
import type { Order, OrderStatus } from "../types";

const POLL_INTERVAL_MS = 20000;

export default function OrdersPage() {
  const nav = useNavigate();
  const toast = useToast();
  const [updating, setUpdating] = useState<number | null>(null);

  const { data, loading, refreshing, error, refresh } = useResource<Order[]>(
    "courier_orders",
    () => get<Order[]>("/courier/orders"),
    { pollMs: POLL_INTERVAL_MS, errorText: "Buyurtmalarni yangilab bo'lmadi. Internetni tekshiring." }
  );
  const orders = data ?? [];

  useEffect(() => {
    const onPush = () => refresh();
    window.addEventListener("courier-push", onPush);
    return () => window.removeEventListener("courier-push", onPush);
  }, [refresh]);

  const setStatus = async (id: number, status: OrderStatus) => {
    setUpdating(id);
    try {
      await patch(`/courier/orders/${id}`, { status });
      toast.success(
        status === "accepted"
          ? "Buyurtma qabul qilindi ✅"
          : status === "delivering"
            ? "Yetkazish boshlandi 🛵 — mijozga ETA yuborildi"
            : "Holat yangilandi"
      );
      refresh();
    } catch {
      toast.error("Holatni o'zgartirib bo'lmadi. Qayta urinib ko'ring.");
    } finally {
      setUpdating(null);
    }
  };

  const markDelivered = async (id: number) => {
    setUpdating(id);
    try {
      await post(`/courier/orders/${id}/delivered`, {});
      toast.success("Buyurtma yetkazildi ✅");
      refresh();
    } catch {
      toast.error("Yakunlab bo'lmadi. Qayta urinib ko'ring.");
    } finally {
      setUpdating(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Buyurtmalar"
        subtitle={`Faol: ${orders.length}`}
        loading={loading || refreshing}
        onRefresh={refresh}
      />

      {loading ? (
        <ListSkeleton count={3} />
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
              <Bike size={32} className="mx-auto mb-2 opacity-30" />
              <p>Hozircha buyurtma yo'q</p>
            </motion.div>
          )}

          <motion.div
            className="space-y-3"
            variants={listContainer}
            initial="initial"
            animate="animate"
          >
            <AnimatePresence initial={false}>
              {orders.map((o) => (
                <motion.div
                  key={o.id}
                  layout
                  variants={listItem}
                  exit="exit"
                  className="card p-4"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="font-bold text-lg">№ {o.number}</span>
                      <span className={`ml-2 pill ${statusPill(o.status)}`}>{statusLabel(o.status)}</span>
                    </div>
                    <span className="font-bold text-brand">{money(o.total)} so'm</span>
                  </div>

                  <div className="space-y-1 text-sm text-slate-600 mb-3">
                    <div className="flex items-start gap-1.5">
                      <MapPin size={14} className="shrink-0 mt-0.5 text-slate-400" />
                      <span>{o.address_line}</span>
                    </div>
                    {o.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone size={14} className="text-slate-400" />
                        <a href={`tel:${o.phone}`} className="text-brand font-medium">{o.phone}</a>
                      </div>
                    )}
                    {(distanceLabel(o.distance_km) || etaLabel(o.eta_minutes)) && (
                      <div className="flex items-center gap-3 text-xs text-slate-500 pt-0.5">
                        {distanceLabel(o.distance_km) && (
                          <span className="flex items-center gap-1">
                            <Navigation size={12} className="text-slate-400" />
                            {distanceLabel(o.distance_km)}
                          </span>
                        )}
                        {etaLabel(o.eta_minutes) && (
                          <span className="flex items-center gap-1">
                            <Clock size={12} className="text-slate-400" />
                            {etaLabel(o.eta_minutes)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 mb-3 overflow-x-auto">
                    {o.items.map((it) =>
                      it.image_url ? (
                        <img
                          key={it.id}
                          src={it.image_url}
                          alt={it.name_uz}
                          title={`${it.name_uz} · ${qtyUnit(it.quantity, it.unit)}${it.note ? ` · ${it.note}` : ""}`}
                          className="h-10 w-10 rounded-lg object-cover bg-slate-100 shrink-0"
                        />
                      ) : (
                        <div
                          key={it.id}
                          title={`${it.name_uz} · ${qtyUnit(it.quantity, it.unit)}${it.note ? ` · ${it.note}` : ""}`}
                          className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center text-sm shrink-0"
                        >
                          🍽
                        </div>
                      )
                    )}
                    <span className="text-xs text-slate-400 ml-1 shrink-0">
                      {o.items.length} ta mahsulot
                    </span>
                  </div>

                  {o.items.some((it) => it.note) && (
                    <div className="mb-3 -mt-1 text-xs text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5 flex items-center gap-1">
                      💬 Mahsulot izohlari bor — batafsilda ko'ring
                    </div>
                  )}

                  <div className="flex gap-2">
                    <motion.button
                      whileTap={tap}
                      className="btn-ghost flex-1 justify-center text-sm py-2"
                      onClick={() => nav(`/orders/${o.id}`)}
                    >
                      Batafsil
                    </motion.button>
                    {isAcceptableOrderStatus(o.status) && (
                      <motion.button
                        whileTap={tap}
                        className="btn flex-1 justify-center text-sm py-2 !bg-cyan-600"
                        disabled={updating === o.id}
                        onClick={() => setStatus(o.id, "accepted")}
                      >
                        {updating === o.id ? "…" : "Qabul qilish ✅"}
                      </motion.button>
                    )}
                    {o.status === "accepted" && (
                      <motion.button
                        whileTap={tap}
                        className="btn flex-1 justify-center text-sm py-2 !bg-blue-600"
                        disabled={updating === o.id}
                        onClick={() => setStatus(o.id, "delivering")}
                      >
                        {updating === o.id ? "…" : "Yetkazaman 🛵"}
                      </motion.button>
                    )}
                    {o.status === "delivering" && (
                      <motion.button
                        whileTap={tap}
                        className="btn flex-1 justify-center text-sm py-2 !bg-emerald-600"
                        disabled={updating === o.id}
                        onClick={() => markDelivered(o.id)}
                      >
                        {updating === o.id ? "…" : "Yetkazdim ✓"}
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </>
  );
}
