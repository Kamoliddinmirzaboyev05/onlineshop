import { CircleCheck, CircleX, Plus, Power, Trash2, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { del, get, patch, post } from "../api";
import { confirm } from "../components/Confirm";
import { ErrorRetry, TableSkeleton } from "../components/Skeleton";
import type { BusinessRow } from "../types";

// api.ts xatoni `"<status>: <text>"` ko'rinishida tashlaydi.
const isConflict = (e: unknown) => e instanceof Error && e.message.startsWith("409");

type Form = { name: string; username: string; password: string; phone: string };
const EMPTY: Form = { name: "", username: "", password: "", phone: "" };

export default function BusinessesPage() {
  const [items, setItems] = useState<BusinessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setErr(false);
    setLoading(true);
    get<BusinessRow[]>("/platform/businesses")
      .then((d) => { setItems(d); setLoading(false); })
      .catch(() => { setErr(true); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form || !form.name.trim() || !form.username.trim() || !form.password.trim() || saving) return;
    setSaving(true);
    try {
      await post("/platform/businesses", {
        name: form.name.trim(),
        username: form.username.trim(),
        password: form.password,
        phone: form.phone.trim() || undefined,
      });
      setForm(null);
      toast.success("Tadbirkor qo'shildi");
      load();
    } catch (e) {
      toast.error(isConflict(e) ? "Bu username allaqachon band" : "Qo'shib bo'lmadi");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (b: BusinessRow) => {
    setBusy(b.id);
    try {
      await patch(`/platform/businesses/${b.id}/toggle`, {});
      setItems((prev) => prev.map((x) => (x.id === b.id ? { ...x, is_active: !x.is_active } : x)));
      toast.success(b.is_active ? "Faolsizlantirildi" : "Faollashtirildi");
    } catch {
      toast.error("Amalni bajarib bo'lmadi");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (b: BusinessRow) => {
    const ok = await confirm({
      title: `"${b.name}" tadbirkorni o'chirasizmi?`,
      message: "Bu amalni qaytarib bo'lmaydi.",
      confirmText: "O'chirish",
      danger: true,
    });
    if (!ok) return;
    setBusy(b.id);
    try {
      await del(`/platform/businesses/${b.id}`);
      setItems((prev) => prev.filter((x) => x.id !== b.id));
      toast.success("Tadbirkor o'chirildi");
    } catch (e) {
      toast.error(isConflict(e) ? "Do'konlari bor — avval do'konlarni o'chiring" : "O'chirib bo'lmadi");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Tadbirkorlar</h1>
        <button className="btn" onClick={() => setForm(EMPTY)}>
          <Plus size={18} /> Yangi tadbirkor
        </button>
      </div>

      {err ? <ErrorRetry onRetry={load} /> : loading ? <TableSkeleton cols={6} /> : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className="th">Nomi</th>
                <th className="th">Username</th>
                <th className="th">Telefon</th>
                <th className="th">Do'konlar</th>
                <th className="th">Ro'yxatdan o'tgan</th>
                <th className="th text-right">Amallar</th>
              </tr>
            </thead>
            <tbody>
              {items.map((b) => (
                <tr
                  key={b.id}
                  className={b.is_active ? "hover:bg-slate-50/60" : "bg-red-50/60 hover:bg-red-50"}
                >
                  <td className="td font-medium text-slate-900">
                    <span className="inline-flex items-center gap-2">
                      {b.name}
                      {!b.is_active && (
                        <span className="text-[11px] font-semibold text-red-600 bg-red-100 rounded-full px-2 py-0.5">
                          Faolsiz
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="td">@{b.username}</td>
                  <td className="td">{b.phone ?? "—"}</td>
                  <td className="td">{b.stores_count}</td>
                  <td className="td">{new Date(b.created_at).toLocaleDateString()}</td>
                  <td className="td">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => toggle(b)}
                        disabled={busy === b.id}
                        title={b.is_active ? "Faolsizlantirish" : "Faollashtirish"}
                        className={`inline-flex items-center gap-1 text-xs font-medium rounded-lg px-2.5 py-1.5 disabled:opacity-50 ${
                          b.is_active
                            ? "text-amber-700 bg-amber-50 hover:bg-amber-100"
                            : "text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                        }`}
                      >
                        <Power size={14} />
                        {b.is_active ? "Faolsizlantir" : "Faollashtir"}
                      </button>
                      <button
                        onClick={() => remove(b)}
                        disabled={busy === b.id}
                        title="O'chirish"
                        className="inline-flex items-center gap-1 text-xs font-medium rounded-lg px-2.5 py-1.5 text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-50"
                      >
                        <Trash2 size={14} /> O'chirish
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={6} className="td text-center text-slate-400 py-10">Hali tadbirkor yo'q</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="card p-6 w-[26rem] max-h-[90vh] overflow-auto space-y-3">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <UserPlus size={18} /> Yangi tadbirkor
            </h2>

            <label className="block">
              <span className="text-xs text-slate-500">Nomi</span>
              <input
                className="input mt-1"
                placeholder="Tadbirkor nomi"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>

            <label className="block">
              <span className="text-xs text-slate-500">Username</span>
              <input
                className="input mt-1"
                placeholder="login"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </label>

            <label className="block">
              <span className="text-xs text-slate-500">Parol</span>
              <input
                className="input mt-1"
                type="password"
                placeholder="parol"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </label>

            <label className="block">
              <span className="text-xs text-slate-500">Telefon (ixtiyoriy)</span>
              <input
                className="input mt-1"
                placeholder="+998..."
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </label>

            <div className="flex gap-2 justify-end pt-2">
              <button className="btn-ghost" onClick={() => setForm(null)}>
                <CircleX size={16} /> Bekor
              </button>
              <button
                className="btn"
                onClick={save}
                disabled={saving || !form.name.trim() || !form.username.trim() || !form.password.trim()}
              >
                <CircleCheck size={16} /> Saqlash
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
