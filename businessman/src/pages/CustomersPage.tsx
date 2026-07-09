import { useEffect, useState } from "react";
import { get, withStore } from "../api";
import { ErrorRetry, TableSkeleton } from "../components/Skeleton";
import { useStore } from "../store";
import type { Customer } from "../types";

export default function CustomersPage() {
  const selectedStoreId = useStore((s) => s.selectedStoreId);
  const [items, setItems] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);

  const load = () => {
    if (selectedStoreId == null) return;
    setErr(false);
    setLoading(true);
    get<Customer[]>(withStore("/admin/users", selectedStoreId))
      .then((d) => { setItems(d); setLoading(false); })
      .catch(() => { setErr(true); setLoading(false); });
  };

  useEffect(() => { load(); }, [selectedStoreId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (selectedStoreId == null) {
    return (
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-1">Mijozlar</h1>
        <div className="card p-10 text-center text-slate-400 mt-5">Avval do'kon tanlang</div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-1">Mijozlar</h1>
      <p className="text-slate-500 mb-5">Shu do'kondan buyurtma bergan mijozlar.</p>
      {err ? <ErrorRetry onRetry={load} /> : loading ? <TableSkeleton cols={5} /> : (
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50">
              <th className="th">Ism</th>
              <th className="th">Username</th>
              <th className="th">Telefon</th>
              <th className="th">Til</th>
              <th className="th">Ro'yxatdan o'tgan</th>
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
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={5} className="td text-center text-slate-400 py-10">Mijozlar yo'q</td></tr>
            )}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
