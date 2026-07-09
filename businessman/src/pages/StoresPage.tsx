import { CircleCheck, CircleX, Pencil, Plus, Store, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { del, get, post, put } from "../api";
import { confirm } from "../components/Confirm";
import { TableSkeleton } from "../components/Skeleton";
import type { Store as StoreT, StoreInput } from "../types";

const money = (n: number) => n.toLocaleString("ru-RU").replace(/,/g, " ");

const emptyForm: StoreInput = {
  name: "",
  address: "",
  owner_name: "",
  phones: [],
  socials: {},
  delivery_fee: 0,
  min_order: 0,
  avg_delivery_minutes: 30,
  is_active: true,
  is_open: true,
};

export default function StoresPage() {
  const [stores, setStores] = useState<StoreT[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<number | null>(null); // null = closed, 0 = new
  const [form, setForm] = useState<StoreInput>(emptyForm);
  const [err, setErr] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      setStores(await get<StoreT[]>("/business/stores"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setErr("");
    setForm(emptyForm);
    setEditId(0);
  };

  const openEdit = (s: StoreT) => {
    setErr("");
    setForm({
      name: s.name,
      address: s.address ?? "",
      owner_name: s.owner_name ?? "",
      phones: s.phones,
      socials: s.socials,
      delivery_fee: s.delivery_fee,
      min_order: s.min_order,
      avg_delivery_minutes: s.avg_delivery_minutes,
      is_active: s.is_active,
      is_open: s.is_open,
    });
    setEditId(s.id);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setErr("");
    try {
      if (editId) await put(`/business/stores/${editId}`, form);
      else await post("/business/stores", form);
      setEditId(null);
      toast.success(editId ? "Do'kon yangilandi" : "Do'kon yaratildi");
      load();
    } catch (e) {
      setErr(String(e).replace("Error: ", ""));
    }
  };

  const remove = async (s: StoreT) => {
    const ok = await confirm({
      title: `"${s.name}" do'konni o'chirasizmi?`,
      message: "Bu amalni ortga qaytarib bo'lmaydi.",
      confirmText: "O'chirish",
      danger: true,
    });
    if (!ok) return;
    try {
      await del(`/business/stores/${s.id}`);
      toast.success("Do'kon o'chirildi");
      load();
    } catch (e) {
      if (String(e).includes("409")) {
        toast.error("Buyurtma tarixi bor do'konni o'chirib bo'lmaydi");
      } else {
        toast.error("O'chirib bo'lmadi");
      }
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-1">Do'konlar</h1>
      <p className="text-slate-500 mb-5">Do'konlaringizni qo'shish va boshqarish.</p>

      <div className="flex justify-end mb-4">
        <button className="btn" onClick={openNew}>
          <Plus size={18} /> Yangi do'kon
        </button>
      </div>

      {loading ? <TableSkeleton cols={5} /> : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className="th">Nomi</th>
                <th className="th">Manzil</th>
                <th className="th">Yetkazish</th>
                <th className="th">Min. buyurtma</th>
                <th className="th">Holati</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {stores.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/60">
                  <td className="td font-medium text-slate-900">{s.name}</td>
                  <td className="td text-slate-500">{s.address || "—"}</td>
                  <td className="td">{money(s.delivery_fee)} so'm</td>
                  <td className="td">{money(s.min_order)} so'm</td>
                  <td className="td">
                    <div className="flex flex-wrap gap-1">
                      {s.is_active
                        ? <span className="pill bg-emerald-100 text-emerald-700">Faol</span>
                        : <span className="pill bg-slate-100 text-slate-500">Nofaol</span>}
                      {s.is_open
                        ? <span className="pill bg-sky-100 text-sky-700">Ochiq</span>
                        : <span className="pill bg-amber-100 text-amber-700">Yopiq</span>}
                    </div>
                  </td>
                  <td className="td text-right">
                    <div className="inline-flex items-center gap-1">
                      <button className="icon-btn" title="Tahrirlash" onClick={() => openEdit(s)}>
                        <Pencil size={15} />
                      </button>
                      <button className="icon-btn hover:text-red-600" title="O'chirish" onClick={() => remove(s)}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {stores.length === 0 && (
                <tr>
                  <td colSpan={6} className="td text-center text-slate-400 py-10">
                    <Store size={28} className="mx-auto mb-2 opacity-30" />
                    Hali do'kon yo'q — "Yangi do'kon" tugmasini bosing
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editId != null && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="card p-6 w-[28rem] max-w-full space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="font-bold text-lg">{editId ? "Do'konni tahrirlash" : "Yangi do'kon"}</h2>

            <label className="block">
              <span className="text-xs text-slate-500">Nomi *</span>
              <input
                className="input mt-1"
                placeholder="Do'kon nomi"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>

            <label className="block">
              <span className="text-xs text-slate-500">Manzil</span>
              <input
                className="input mt-1"
                value={form.address ?? ""}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </label>

            <label className="block">
              <span className="text-xs text-slate-500">Egasi</span>
              <input
                className="input mt-1"
                value={form.owner_name ?? ""}
                onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs text-slate-500">Yetkazish narxi</span>
                <input
                  className="input mt-1"
                  type="number"
                  value={form.delivery_fee}
                  onChange={(e) => setForm({ ...form, delivery_fee: Number(e.target.value) })}
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-500">Min. buyurtma</span>
                <input
                  className="input mt-1"
                  type="number"
                  value={form.min_order}
                  onChange={(e) => setForm({ ...form, min_order: Number(e.target.value) })}
                />
              </label>
            </div>

            <label className="block">
              <span className="text-xs text-slate-500">O'rtacha yetkazish (daqiqa)</span>
              <input
                className="input mt-1"
                type="number"
                value={form.avg_delivery_minutes}
                onChange={(e) => setForm({ ...form, avg_delivery_minutes: Number(e.target.value) })}
              />
            </label>

            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                />
                Faol
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_open}
                  onChange={(e) => setForm({ ...form, is_open: e.target.checked })}
                />
                Ochiq
              </label>
            </div>

            {err && (
              <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</div>
            )}

            <div className="flex gap-2 justify-end pt-1">
              <button className="btn-ghost" onClick={() => setEditId(null)}>
                <CircleX size={16} /> Bekor
              </button>
              <button className="btn" onClick={save} disabled={!form.name.trim()}>
                <CircleCheck size={16} /> Saqlash
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
