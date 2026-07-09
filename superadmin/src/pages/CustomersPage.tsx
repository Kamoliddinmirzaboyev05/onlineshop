import { Ban, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { del, get, patch } from "../api";
import { confirm } from "../components/Confirm";
import { ErrorRetry, TableSkeleton } from "../components/Skeleton";
import type { UserRow } from "../types";

export default function CustomersPage() {
  const [items, setItems] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);

  const load = () => {
    setErr(false);
    setLoading(true);
    get<UserRow[]>("/platform/users")
      .then((d) => { setItems(d); setLoading(false); })
      .catch(() => { setErr(true); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const toggleBlock = async (u: UserRow) => {
    setBusy(u.id);
    try {
      const updated = await patch<UserRow>(`/platform/users/${u.id}/block`, {
        blocked: !u.is_blocked,
      });
      setItems((prev) => prev.map((x) => (x.id === u.id ? updated : x)));
      toast.success(updated.is_blocked ? "Foydalanuvchi bloklandi" : "Blokdan chiqarildi");
    } catch {
      toast.error("Amalni bajarib bo'lmadi");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (u: UserRow) => {
    const label = u.first_name || u.username || `#${u.id}`;
    const ok = await confirm({
      title: `"${label}" foydalanuvchini o'chirasizmi?`,
      message: "Barcha buyurtmalari ham o'chadi. Bu amalni qaytarib bo'lmaydi.",
      confirmText: "O'chirish",
      danger: true,
    });
    if (!ok) return;
    setBusy(u.id);
    try {
      await del(`/platform/users/${u.id}`);
      setItems((prev) => prev.filter((x) => x.id !== u.id));
      toast.success("Foydalanuvchi o'chirildi");
    } catch {
      toast.error("O'chirib bo'lmadi");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-5">Mijozlar</h1>
      {err ? <ErrorRetry onRetry={load} /> : loading ? <TableSkeleton cols={6} /> : (
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50">
              <th className="th">Ism</th>
              <th className="th">Username</th>
              <th className="th">Telefon</th>
              <th className="th">Til</th>
              <th className="th">Ro'yxatdan o'tgan</th>
              <th className="th text-right">Amallar</th>
            </tr>
          </thead>
          <tbody>
            {items.map((u) => (
              <tr
                key={u.id}
                className={u.is_blocked ? "bg-red-50/60 hover:bg-red-50" : "hover:bg-slate-50/60"}
              >
                <td className="td font-medium text-slate-900">
                  <span className="inline-flex items-center gap-2">
                    {u.first_name ?? "—"}
                    {u.is_blocked && (
                      <span className="text-[11px] font-semibold text-red-600 bg-red-100 rounded-full px-2 py-0.5">
                        Bloklangan
                      </span>
                    )}
                  </span>
                </td>
                <td className="td">{u.username ? `@${u.username}` : "—"}</td>
                <td className="td">{u.phone ?? "—"}</td>
                <td className="td uppercase">{u.language}</td>
                <td className="td">{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="td">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => toggleBlock(u)}
                      disabled={busy === u.id}
                      title={u.is_blocked ? "Blokdan chiqarish" : "Bloklash"}
                      className={`inline-flex items-center gap-1 text-xs font-medium rounded-lg px-2.5 py-1.5 disabled:opacity-50 ${
                        u.is_blocked
                          ? "text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                          : "text-amber-700 bg-amber-50 hover:bg-amber-100"
                      }`}
                    >
                      {u.is_blocked ? <ShieldCheck size={14} /> : <Ban size={14} />}
                      {u.is_blocked ? "Blokdan chiqar" : "Bloklash"}
                    </button>
                    <button
                      onClick={() => remove(u)}
                      disabled={busy === u.id}
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
              <tr><td colSpan={6} className="td text-center text-slate-400 py-10">Hali mijoz yo'q</td></tr>
            )}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
