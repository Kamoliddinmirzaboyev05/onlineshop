import { ChevronDown, MapPin, Phone, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { get, patch, withStore } from "../api";
import { confirm } from "../components/Confirm";
import { ErrorRetry, TableSkeleton } from "../components/Skeleton";
import { useStore } from "../store";
import type { Order, OrderStatus } from "../types";

const STATUSES: OrderStatus[] = [
  "pending", "confirmed", "preparing", "ready", "accepted", "delivering", "delivered", "cancelled",
];
const LABEL: Record<OrderStatus, string> = {
  pending: "Yangi", confirmed: "Tasdiqlandi", preparing: "Tayyorlanmoqda",
  ready: "Tayyor", accepted: "Kuryer qabul qildi", delivering: "Yetkazilmoqda",
  delivered: "Yetkazildi", cancelled: "Bekor",
};
const PILL: Record<OrderStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-sky-100 text-sky-700",
  preparing: "bg-indigo-100 text-indigo-700",
  ready: "bg-violet-100 text-violet-700",
  accepted: "bg-cyan-100 text-cyan-700",
  delivering: "bg-blue-100 text-blue-700",
  delivered: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-rose-100 text-rose-700",
};

const money = (n: number) => n.toLocaleString("ru-RU").replace(/,/g, " ");

export default function OrdersPage() {
  const selectedStoreId = useStore((s) => s.selectedStoreId);
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<OrderStatus | "">("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  // Poll tick and manual refresh must not clobber each other's newer state.
  const inFlight = useRef(false);

  const load = async () => {
    if (selectedStoreId == null || inFlight.current) return;
    inFlight.current = true;
    const q = filter ? `?status_filter=${filter}` : "";
    try {
      const d = await get<Order[]>(withStore(`/admin/orders${q}`, selectedStoreId));
      setOrders(d);
      setErr(false);
    } catch {
      setErr(true);
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  };

  useEffect(() => {
    if (selectedStoreId == null) return;
    setLoading(true);
    load();
    const iv = setInterval(load, 15000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, selectedStoreId]);

  const cancel = async (o: Order) => {
    const ok = await confirm({
      title: `№ ${o.number} buyurtmani bekor qilasizmi?`,
      message: "Buyurtma bekor qilinadi. Bu amalni qaytarib bo'lmaydi.",
      confirmText: "Bekor qilish",
      cancelText: "Yo'q",
      danger: true,
    });
    if (!ok || selectedStoreId == null) return;

    const prev = orders;
    setBusy(o.id);
    setOrders((os) => os.map((x) => (x.id === o.id ? { ...x, status: "cancelled" } : x)));
    try {
      await patch(withStore(`/admin/orders/${o.id}`, selectedStoreId), { status: "cancelled" });
      toast.success(`№ ${o.number}: bekor qilindi`);
    } catch {
      setOrders(prev);
      toast.error("Bekor qilib bo'lmadi");
    } finally {
      setBusy(null);
    }
  };

  if (selectedStoreId == null) {
    return (
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-1">Buyurtmalar</h1>
        <div className="card p-10 text-center text-slate-400 mt-5">Avval do'kon tanlang</div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-1">Buyurtmalar</h1>
      <p className="text-slate-500 mb-5">Kuzatuv rejimi — kuryer buyurtmani o'zi qabul qiladi</p>

      <div className="flex gap-2 mb-5 flex-wrap">
        <button className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${filter === "" ? "bg-brand text-white shadow-sm" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
          onClick={() => setFilter("")}>Hammasi</button>
        {STATUSES.map((s) => (
          <button key={s} className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${filter === s ? "bg-brand text-white shadow-sm" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
            onClick={() => setFilter(s)}>{LABEL[s]}</button>
        ))}
      </div>

      {loading ? <TableSkeleton cols={4} /> : err && orders.length === 0 ? <ErrorRetry onRetry={load} /> : (
      <div className="space-y-4">
        {orders.map((o) => {
          const isNew = o.status === "pending";
          const isOpen = open === o.id;
          const itemsCount = o.items.reduce((s, it) => s + it.quantity, 0);
          const canCancel = o.status !== "delivered" && o.status !== "cancelled";
          return (
          <div key={o.id} className={`card p-4 ${isNew ? "ring-2 ring-amber-300 bg-amber-50/40" : ""}`}>
            <div className="flex justify-between items-start gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">№ {o.number}</span>
                  <span className={`pill ${PILL[o.status]}`}>{LABEL[o.status]}</span>
                </div>
                <div className="text-sm text-slate-500 mt-1 flex items-center gap-1.5">
                  <MapPin size={14} className="shrink-0" /> {o.address_line}
                </div>
                {o.phone && (
                  <a href={`tel:${o.phone}`} className="text-sm text-slate-500 flex items-center gap-1.5 hover:text-brand">
                    <Phone size={14} className="shrink-0" /> {o.phone}
                  </a>
                )}
              </div>
              <div className="text-right shrink-0">
                <div className="font-bold">{money(o.total)} so'm</div>
                <div className="text-xs text-slate-400">{new Date(o.created_at).toLocaleString()}</div>
              </div>
            </div>

            <button
              onClick={() => setOpen(isOpen ? null : o.id)}
              className="mt-3 text-sm text-slate-500 inline-flex items-center gap-1 hover:text-brand"
            >
              <ChevronDown size={15} className={`transition ${isOpen ? "rotate-180" : ""}`} />
              {itemsCount} dona mahsulot
            </button>

            {isOpen && (
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                {o.items.map((it) => (
                  <div key={it.id} className="shrink-0 w-16 text-center">
                    {it.image_url ? (
                      <img src={it.image_url} alt="" className="h-16 w-16 rounded-xl object-cover bg-slate-100" />
                    ) : (
                      <div className="h-16 w-16 rounded-xl bg-slate-100 flex items-center justify-center text-xl">🍽</div>
                    )}
                    <div className="text-[11px] text-slate-600 mt-1 leading-tight line-clamp-2">{it.name_uz}</div>
                    <div className="text-[11px] font-semibold text-slate-400">×{it.quantity}</div>
                  </div>
                ))}
              </div>
            )}

            {canCancel && (
              <div className="mt-3">
                <button
                  disabled={busy === o.id}
                  onClick={() => cancel(o)}
                  className="px-3 py-2.5 rounded-xl border border-rose-200 text-rose-600 text-sm font-medium hover:bg-rose-50 transition inline-flex items-center gap-1 disabled:opacity-40"
                >
                  <X size={15} /> Bekor qilish
                </button>
              </div>
            )}
          </div>
          );
        })}
        {orders.length === 0 && (
          <div className="card p-10 text-center text-slate-400">Buyurtmalar yo'q</div>
        )}
      </div>
      )}
    </div>
  );
}
