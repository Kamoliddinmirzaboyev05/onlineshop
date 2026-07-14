import { AlertTriangle, Ban, CircleCheck, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { del, get, patch } from "../api";
import { ErrorRetry, TableSkeleton } from "../components/Skeleton";
import type { BusinessRow, StoreRow } from "../types";

const DELETE_WORD = "o'chirish";

export default function StoresPage() {
  const [items, setItems] = useState<StoreRow[]>([]);
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StoreRow | null>(null);
  const [nameConfirm, setNameConfirm] = useState("");
  const [wordConfirm, setWordConfirm] = useState("");

  const load = () => {
    setErr(false);
    setLoading(true);
    get<StoreRow[]>("/platform/stores")
      .then((d) => { setItems(d); setLoading(false); })
      .catch(() => { setErr(true); setLoading(false); });
    get<BusinessRow[]>("/platform/businesses").then(setBusinesses).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const reassign = async (s: StoreRow, businessId: number) => {
    if (businessId === s.business_id) return;
    setBusy(s.id);
    try {
      const updated = await patch<StoreRow>(`/platform/stores/${s.id}/business`, { business_id: businessId });
      setItems((prev) => prev.map((x) => (x.id === s.id ? updated : x)));
      toast.success("Tadbirkor o'zgartirildi");
    } catch {
      toast.error("O'zgartirib bo'lmadi");
    } finally {
      setBusy(null);
    }
  };

  const openDelete = (s: StoreRow) => {
    setDeleteTarget(s);
    setNameConfirm("");
    setWordConfirm("");
  };

  const closeDelete = () => {
    setDeleteTarget(null);
    setNameConfirm("");
    setWordConfirm("");
  };

  const canDelete =
    !!deleteTarget &&
    nameConfirm.trim() === deleteTarget.name &&
    wordConfirm.trim().toLowerCase() === DELETE_WORD;

  const confirmDelete = async () => {
    if (!deleteTarget || !canDelete) return;
    setBusy(deleteTarget.id);
    try {
      await del(`/platform/stores/${deleteTarget.id}?force=true`);
      setItems((prev) => prev.filter((x) => x.id !== deleteTarget.id));
      toast.success("Do'kon butunlay o'chirildi");
      closeDelete();
    } catch {
      toast.error("O'chirib bo'lmadi");
    } finally {
      setBusy(null);
    }
  };

  const toggle = async (s: StoreRow) => {
    setBusy(s.id);
    try {
      const updated = await patch<StoreRow>(`/platform/stores/${s.id}/toggle`, {});
      setItems((prev) => prev.map((x) => (x.id === s.id ? updated : x)));
      toast.success(updated.is_active ? "Do'kon faollashtirildi" : "Do'kon faolsizlantirildi");
    } catch {
      toast.error("O'zgartirib bo'lmadi");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Do'konlar</h1>
      </div>

      {err ? <ErrorRetry onRetry={load} /> : loading ? <TableSkeleton cols={6} /> : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className="th">Nomi</th>
                <th className="th">Tadbirkor</th>
                <th className="th">Manzil</th>
                <th className="th">Holati</th>
                <th className="th">Yaratilgan</th>
                <th className="th text-right">Amallar</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id} className={s.is_active ? "hover:bg-slate-50/60" : "bg-red-50/60 hover:bg-red-50"}>
                  <td className="td font-medium text-slate-900">
                    <span className="inline-flex items-center gap-2">
                      {s.name}
                      {!s.is_active && (
                        <span className="text-[11px] font-semibold text-red-600 bg-red-100 rounded-full px-2 py-0.5">
                          Faolsiz
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="td">
                    <select
                      className="input py-1 text-sm max-w-[180px]"
                      value={s.business_id}
                      disabled={busy === s.id}
                      onChange={(e) => reassign(s, Number(e.target.value))}
                    >
                      {businesses.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="td">{s.address ?? "—"}</td>
                  <td className="td">{s.is_open ? "Ochiq" : "Yopiq"}</td>
                  <td className="td">{new Date(s.created_at).toLocaleDateString()}</td>
                  <td className="td">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => toggle(s)}
                        disabled={busy === s.id}
                        title={s.is_active ? "Faolsizlantirish" : "Faollashtirish"}
                        className="inline-flex items-center gap-1 text-xs font-medium rounded-lg px-2.5 py-1.5 text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50"
                      >
                        {s.is_active ? <Ban size={14} /> : <CircleCheck size={14} />}
                        {s.is_active ? "Faolsizlantirish" : "Faollashtirish"}
                      </button>
                      <button
                        onClick={() => openDelete(s)}
                        disabled={busy === s.id}
                        title="Butunlay o'chirish"
                        className="inline-flex items-center gap-1 text-xs font-medium rounded-lg px-2.5 py-1.5 text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-50"
                      >
                        <Trash2 size={14} /> O'chirish
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={6} className="td text-center text-slate-400 py-10">Hali do'kon yo'q</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          onClick={closeDelete}
        >
          <div
            className="card w-full max-w-sm p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start gap-3">
              <span className="grid place-items-center h-11 w-11 shrink-0 rounded-2xl bg-rose-50 text-rose-600">
                <AlertTriangle size={22} />
              </span>
              <div>
                <h2 className="text-lg font-bold tracking-tight">"{deleteTarget.name}" butunlay o'chiriladi</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Mahsulotlar, kategoriyalar, xodimlar VA buyurtma tarixi — barchasi qaytarib bo'lmas tarzda o'chadi.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Tasdiqlash uchun do'kon nomini kiriting: <b>{deleteTarget.name}</b>
              </label>
              <input
                className="input w-full"
                value={nameConfirm}
                onChange={(e) => setNameConfirm(e.target.value)}
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Va "<b>{DELETE_WORD}</b>" deb yozing
              </label>
              <input
                className="input w-full"
                value={wordConfirm}
                onChange={(e) => setWordConfirm(e.target.value)}
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button className="btn-ghost flex-1 justify-center" onClick={closeDelete}>
                Bekor
              </button>
              <button
                disabled={!canDelete || busy === deleteTarget.id}
                onClick={confirmDelete}
                className="flex-1 justify-center inline-flex items-center gap-2 font-medium rounded-lg px-4 py-2 shadow-sm text-white transition active:scale-[.98] bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:pointer-events-none"
              >
                <Trash2 size={16} /> Butunlay o'chirish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
