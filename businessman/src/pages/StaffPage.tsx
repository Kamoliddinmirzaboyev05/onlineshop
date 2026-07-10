import { CircleCheck, CircleX, Plus, PowerOff, Store, Trash2, Users } from "lucide-react";
import PasswordInput from "../components/PasswordInput";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { del, get, patch, post, withStore } from "../api";
import { confirm } from "../components/Confirm";
import { TableSkeleton } from "../components/Skeleton";
import { useStore } from "../store";
import type { StaffUser } from "../types";

const ROLE_LABEL: Record<string, string> = {
  superadmin: "Do'kon egasi",
  manager: "Menejer",
  courier: "Kuryer",
};
const ROLE_PILL: Record<string, string> = {
  superadmin: "bg-rose-100 text-rose-700",
  manager: "bg-sky-100 text-sky-700",
  courier: "bg-violet-100 text-violet-700",
};

export default function StaffPage() {
  const storeId = useStore((s) => s.selectedStoreId);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<{ username: string; password: string; role: "manager" | "courier" } | null>(null);
  const [err, setErr] = useState("");

  const load = async (id: number) => {
    setLoading(true);
    try {
      setStaff(await get<StaffUser[]>(withStore("/admin/admin-users", id)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (storeId != null) load(storeId);
  }, [storeId]);

  const save = async () => {
    if (storeId == null || !form || !form.username.trim() || !form.password.trim()) return;
    setErr("");
    try {
      await post(withStore("/admin/admin-users", storeId), form);
      setForm(null);
      toast.success("Xodim yaratildi");
      load(storeId);
    } catch (e) {
      if (String(e).includes("409")) {
        setErr("Bu username band");
        toast.error("Bu username band");
      } else {
        setErr(String(e).replace("Error: ", ""));
      }
    }
  };

  const toggle = async (u: StaffUser) => {
    if (storeId == null) return;
    try {
      await patch(withStore(`/admin/admin-users/${u.id}/toggle`, storeId), {});
      toast.success(u.is_active ? "Xodim bloklandi" : "Xodim aktivlashtirildi");
      load(storeId);
    } catch {
      toast.error("Amalni bajarib bo'lmadi");
    }
  };

  const remove = async (u: StaffUser) => {
    if (storeId == null) return;
    const ok = await confirm({
      title: `"${u.username}" xodimni o'chirasizmi?`,
      message: "Bu akkaunt butunlay o'chiriladi.",
      confirmText: "O'chirish",
      danger: true,
    });
    if (!ok) return;
    try {
      await del(withStore(`/admin/admin-users/${u.id}`, storeId));
      toast.success("Xodim o'chirildi");
      load(storeId);
    } catch {
      toast.error("O'chirib bo'lmadi");
    }
  };

  if (storeId == null) {
    return (
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-1">Xodimlar</h1>
        <div className="card p-10 text-center text-slate-400 mt-5">
          <Store size={32} className="mx-auto mb-3 opacity-30" />
          Avval "Do'konlar" bo'limida do'kon yarating, so'ng yuqoridagi ro'yxatdan tanlang
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-1">Xodimlar</h1>
      <p className="text-slate-500 mb-5">Do'kon menejer va kuryer akkauntlari.</p>

      <div className="flex justify-end mb-4">
        <button
          className="btn"
          onClick={() => { setErr(""); setForm({ username: "", password: "", role: "courier" }); }}
        >
          <Plus size={18} /> Yangi xodim
        </button>
      </div>

      {loading ? <TableSkeleton cols={4} /> : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className="th">Login</th>
                <th className="th">Rol</th>
                <th className="th">Holat</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {staff.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/60">
                  <td className="td font-medium text-slate-900">
                    <div className="flex items-center gap-2">
                      <span className="h-8 w-8 rounded-full bg-brand/10 text-brand text-sm font-bold flex items-center justify-center uppercase">
                        {u.username[0]}
                      </span>
                      {u.username}
                    </div>
                  </td>
                  <td className="td">
                    <span className={`pill ${ROLE_PILL[u.role] ?? "bg-slate-100 text-slate-600"}`}>
                      {ROLE_LABEL[u.role] ?? u.role}
                    </span>
                  </td>
                  <td className="td">
                    {u.is_active
                      ? <span className="pill bg-emerald-100 text-emerald-700">Faol</span>
                      : <span className="pill bg-slate-100 text-slate-500">Bloklangan</span>}
                  </td>
                  <td className="td text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        className="icon-btn"
                        title={u.is_active ? "Bloklash" : "Aktivlashtirish"}
                        onClick={() => toggle(u)}
                      >
                        <PowerOff size={15} className={u.is_active ? "text-amber-500" : "text-emerald-500"} />
                      </button>
                      <button
                        className="icon-btn hover:text-red-600"
                        title="O'chirish"
                        onClick={() => remove(u)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {staff.length === 0 && (
                <tr>
                  <td colSpan={4} className="td text-center text-slate-400 py-10">
                    <Users size={28} className="mx-auto mb-2 opacity-30" />
                    Hali xodim yo'q — "Yangi xodim" tugmasini bosing
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="card p-6 w-96 space-y-4">
            <h2 className="font-bold text-lg">Yangi xodim</h2>

            <label className="block">
              <span className="text-xs text-slate-500">Login</span>
              <input
                className="input mt-1"
                placeholder="kuryer1"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </label>

            <label className="block">
              <span className="text-xs text-slate-500">Parol</span>
              <PasswordInput
                className="input mt-1"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </label>

            <label className="block">
              <span className="text-xs text-slate-500">Rol</span>
              <select
                className="input mt-1"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as "manager" | "courier" })}
              >
                <option value="courier">Kuryer</option>
                <option value="manager">Menejer</option>
              </select>
            </label>

            {err && (
              <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</div>
            )}

            <div className="flex gap-2 justify-end pt-1">
              <button className="btn-ghost" onClick={() => setForm(null)}>
                <CircleX size={16} /> Bekor
              </button>
              <button
                className="btn"
                onClick={save}
                disabled={!form.username.trim() || !form.password.trim()}
              >
                <CircleCheck size={16} /> Yaratish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
