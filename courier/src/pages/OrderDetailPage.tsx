import { ArrowLeft, Clock, CreditCard, MapPin, Navigation, Phone, Edit2, X } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { get, patch, post } from "../api";
import { OrderDetailSkeleton } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import { useResource } from "../lib/cache";
import { listContainer, listItem, tap } from "../lib/motion";
import {
  distanceLabel,
  etaLabel,
  mapsUrl,
  money,
  paymentLabel,
  qtyUnit,
  statusLabel,
  statusPill,
} from "../lib/format";
import { isAcceptableOrderStatus, isAdjustableOrderStatus } from "../lib/orderActions";
import type { Order, OrderStatus, OrderItem } from "../types";

const POLL_INTERVAL_MS = 15000;

export default function OrderDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [updating, setUpdating] = useState(false);
  const [editingItem, setEditingItem] = useState<OrderItem | null>(null);
  const [editQty, setEditQty] = useState("");

  // 404 → the order is truly gone, leave the screen. Other errors are kept as
  // transient (cache shows last good copy or an inline retry).
  const fetcher = useCallback(
    () =>
      get<Order>(`/courier/orders/${id}`).catch((err) => {
        if (String(err).includes("404")) nav("/orders");
        throw err;
      }),
    [id, nav]
  );

  const { data: order, loading, error, refresh } = useResource<Order>(
    id ? `courier_order_${id}` : null,
    fetcher,
    { pollMs: POLL_INTERVAL_MS, errorText: "Buyurtmani yuklab bo'lmadi. Internetni tekshiring." }
  );

  const setStatus = async (status: OrderStatus) => {
    if (!order) return;
    setUpdating(true);
    try {
      await patch(`/courier/orders/${order.id}`, { status });
      toast.success(
        status === "accepted"
          ? "Buyurtma qabul qilindi ✅"
          : "Yetkazish boshlandi 🛵 — mijozga ETA yuborildi"
      );
      refresh();
    } catch {
      toast.error("Holatni o'zgartirib bo'lmadi. Qayta urinib ko'ring.");
    } finally {
      setUpdating(false);
    }
  };

  const markDelivered = async () => {
    if (!order) return;
    setUpdating(true);
    try {
      await post<Order>(`/courier/orders/${order.id}/delivered`, {});
      toast.success("Buyurtma yetkazildi ✅");
      refresh();
    } catch {
      toast.error("Yakunlab bo'lmadi. Qayta urinib ko'ring.");
    } finally {
      setUpdating(false);
    }
  };

  const handleAdjust = async () => {
    if (!order || !editingItem) return;
    const qty = parseFloat(editQty.replace(",", "."));
    if (isNaN(qty) || qty < 0) {
      toast.error("Noto'g'ri miqdor");
      return;
    }
    
    setUpdating(true);
    try {
      await patch(`/courier/orders/${order.id}/adjust`, {
        items: [{ order_item_id: editingItem.id, quantity: qty }]
      });
      toast.success("Miqdor yangilandi ✅");
      setEditingItem(null);
      refresh();
    } catch {
      toast.error("Miqdorni o'zgartirib bo'lmadi");
    } finally {
      setUpdating(false);
    }
  };


  if (loading && !order) return <OrderDetailSkeleton />;

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-slate-400 p-4 text-center">
        <p>{error ?? "Buyurtmani yuklab bo'lmadi. Internetni tekshiring."}</p>
        <button
          onClick={refresh}
          className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium active:scale-95 transition"
        >
          Qayta urinish
        </button>
      </div>
    );
  }

  const maps = mapsUrl(order.lat, order.lng);

  return (
    <div className="min-h-screen bg-slate-50 p-4 max-w-md mx-auto">
      <motion.button
        whileTap={tap}
        onClick={() => nav(-1)}
        className="flex items-center gap-1.5 text-sm text-slate-500 mb-4"
      >
        <ArrowLeft size={16} /> Orqaga
      </motion.button>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</div>
      )}

      <div className="flex items-center gap-2 mb-1">
        <h1 className="text-xl font-bold">Buyurtma № {order.number}</h1>
        <span className={`pill ${statusPill(order.status)}`}>{statusLabel(order.status)}</span>
      </div>
      <p className="text-sm text-slate-400 mb-4">
        {new Date(order.created_at).toLocaleString("ru-RU")}
      </p>

      <motion.div
        variants={listContainer}
        initial="initial"
        animate="animate"
      >
        <motion.div variants={listItem} className="card p-4 mb-3 space-y-2">
          <div className="flex items-start gap-2 text-sm">
            <MapPin size={16} className="text-brand shrink-0 mt-0.5" />
            <span className="font-medium">{order.address_line}</span>
          </div>
          {order.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone size={16} className="text-brand" />
              <a href={`tel:${order.phone}`} className="text-brand font-semibold underline">
                {order.phone}
              </a>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <CreditCard size={16} className="text-slate-400" />
            <span>
              {paymentLabel(order.payment_method)}
              {order.payment_status === "paid" && (
                <span className="ml-1 text-emerald-600 font-medium">· To'langan</span>
              )}
              {order.payment_method === "cash" && order.payment_status !== "paid" && (
                <span className="ml-1 text-amber-600 font-medium">· Naqd olinadi</span>
              )}
            </span>
          </div>
          {order.comment && (
            <div className="text-sm text-slate-500 bg-amber-50 rounded-lg px-3 py-2">
              💬 {order.comment}
            </div>
          )}
          {(distanceLabel(order.distance_km) || etaLabel(order.eta_minutes)) && (
            <div className="flex items-center gap-4 text-sm pt-1">
              {distanceLabel(order.distance_km) && (
                <span className="flex items-center gap-1.5 text-slate-600">
                  <Navigation size={15} className="text-slate-400" />
                  {distanceLabel(order.distance_km)}
                </span>
              )}
              {etaLabel(order.eta_minutes) && (
                <span className="flex items-center gap-1.5 text-blue-600 font-medium">
                  <Clock size={15} /> {etaLabel(order.eta_minutes)}
                </span>
              )}
            </div>
          )}
          {maps && (
            <motion.a
              whileTap={tap}
              href={maps}
              target="_blank"
              rel="noreferrer"
              className="btn-ghost w-full justify-center text-sm py-2.5 mt-1"
            >
              <Navigation size={16} /> Navigatsiya
            </motion.a>
          )}
        </motion.div>

        <motion.div variants={listItem} className="card p-4 mb-3">
          <h2 className="font-semibold mb-3 text-sm text-slate-500 uppercase tracking-wide">
            Mahsulotlar
          </h2>
          <div className="space-y-2.5">
            {order.items.map((it) => (
              <div key={it.id} className="flex items-center gap-3 text-sm">
                {it.image_url ? (
                  <img src={it.image_url} alt="" className="h-12 w-12 rounded-xl object-cover bg-slate-100 shrink-0" />
                ) : (
                  <div className="h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center text-lg shrink-0">🍽</div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{it.name_uz}</div>
                  <div className="text-xs text-slate-400">
                    {qtyUnit(it.quantity, it.unit)} × {money(it.price)} so'm
                  </div>
                  {it.note && (
                    <div className="mt-1 text-xs text-amber-700 bg-amber-50 rounded-md px-2 py-1 inline-block">
                      💬 {it.note}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0 self-start">
                  <span className="font-semibold">{money(it.price * it.quantity)} so'm</span>
                  {isAdjustableOrderStatus(order.status) && (
                    <button
                      onClick={() => {
                        setEditingItem(it);
                        setEditQty(it.quantity.toString());
                      }}
                      className="text-xs flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-1 rounded-md active:scale-95 transition"
                    >
                      <Edit2 size={12} /> Tahrirlash
                    </button>
                  )}
                </div>
              </div>
            ))}
            <hr className="border-slate-100" />
            <div className="flex justify-between text-sm text-slate-500">
              <span>Yetkazish</span>
              <span>{money(order.delivery_fee)} so'm</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Jami</span>
              <span className="text-brand">{money(order.total)} so'm</span>
            </div>
          </div>
        </motion.div>
      </motion.div>

      <div className="space-y-2">
        {isAcceptableOrderStatus(order.status) && (
          <motion.button
            whileTap={tap}
            className="w-full py-3.5 rounded-2xl bg-cyan-600 text-white font-bold text-base shadow-lg shadow-cyan-200 transition disabled:opacity-50"
            disabled={updating}
            onClick={() => setStatus("accepted")}
          >
            {updating ? "…" : "✅  Qabul qilish"}
          </motion.button>
        )}
        {order.status === "accepted" && (
          <motion.button
            whileTap={tap}
            className="w-full py-3.5 rounded-2xl bg-blue-600 text-white font-bold text-base shadow-lg shadow-blue-200 transition disabled:opacity-50"
            disabled={updating}
            onClick={() => setStatus("delivering")}
          >
            {updating ? "…" : "🛵  Yetkazishni boshlash"}
          </motion.button>
        )}
        {order.status === "delivering" && (
          <motion.button
            whileTap={tap}
            className="w-full py-3.5 rounded-2xl bg-emerald-600 text-white font-bold text-base shadow-lg shadow-emerald-200 transition disabled:opacity-50"
            disabled={updating}
            onClick={markDelivered}
          >
            {updating ? "…" : "✓  Yetkazdim"}
          </motion.button>
        )}
        <motion.button
          whileTap={tap}
          className="w-full py-3 rounded-2xl border border-slate-200 text-slate-600 text-sm font-medium transition"
          onClick={() => nav(-1)}
        >
          Orqaga
        </motion.button>
      </div>

      {/* Edit Quantity Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl"
          >
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-lg">Miqdorni tahrirlash</h3>
              <button onClick={() => setEditingItem(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-3 mb-4">
                {editingItem.image_url ? (
                  <img src={editingItem.image_url} alt="" className="h-12 w-12 rounded-xl object-cover bg-slate-100" />
                ) : (
                  <div className="h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center text-lg">🍽</div>
                )}
                <div>
                  <div className="font-medium">{editingItem.name_uz}</div>
                  <div className="text-sm text-slate-500">{money(editingItem.price)} so'm / {editingItem.unit}</div>
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Yangi miqdor ({editingItem.unit})
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  value={editQty}
                  onChange={(e) => setEditQty(e.target.value)}
                  className="w-full rounded-xl border-slate-200 focus:border-brand focus:ring-brand"
                  placeholder={`Masalan: ${editingItem.quantity}`}
                  autoFocus
                />
              </div>
              <button
                onClick={handleAdjust}
                disabled={updating || !editQty}
                className="w-full btn justify-center py-3 text-base disabled:opacity-50"
              >
                {updating ? "Saqlanmoqda..." : "Saqlash"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
