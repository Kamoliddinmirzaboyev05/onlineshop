import { useEffect, useState } from "react";
import { get } from "../api";
import { ErrorRetry, TableSkeleton } from "../components/Skeleton";

interface UserRow {
  id: number;
  telegram_id: number;
  username?: string | null;
  first_name?: string | null;
  phone?: string | null;
  language: string;
  is_blocked: boolean;
  created_at: string;
}

export default function UsersPage() {
  const [items, setItems] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);

  const load = () => {
    setErr(false);
    setLoading(true);
    get<UserRow[]>("/admin/users")
      .then((d) => { setItems(d); setLoading(false); })
      .catch(() => { setErr(true); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-5">Foydalanuvchilar</h1>
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
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
