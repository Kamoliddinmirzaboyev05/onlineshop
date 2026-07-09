import { Coins, ReceiptText, TrendingUp, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { get } from "../api";
import { ErrorRetry, StatCardsSkeleton } from "../components/Skeleton";
import type { BusinessStats } from "../types";

const money = (n: number) => n.toLocaleString("ru-RU").replace(/,/g, " ");

function Stat({
  label, value, icon: Icon, tint,
}: { label: string; value: string; icon: LucideIcon; tint: string }) {
  return (
    <div className="card p-5 flex items-start justify-between">
      <div>
        <div className="text-sm text-slate-500">{label}</div>
        <div className="text-2xl font-bold mt-1 tracking-tight">{value}</div>
      </div>
      <span className={`grid place-items-center h-10 w-10 rounded-lg ${tint}`}>
        <Icon size={20} />
      </span>
    </div>
  );
}

export default function DashboardPage() {
  const [s, setS] = useState<BusinessStats | null>(null);
  const [err, setErr] = useState(false);

  const load = () => {
    setErr(false);
    get<BusinessStats>("/business/stats?period=month").then(setS).catch(() => setErr(true));
  };

  useEffect(() => { load(); }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-1">Umumiy</h1>
      <p className="text-slate-500 mb-6">So'nggi 30 kun ko'rsatkichlari</p>
      {err && !s ? <ErrorRetry onRetry={load} /> : !s ? <StatCardsSkeleton /> : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat label="Buyurtmalar" value={String(s.total_orders)} icon={ReceiptText} tint="bg-sky-50 text-sky-600" />
            <Stat label="Aylanma" value={`${money(s.total_revenue)} so'm`} icon={Wallet} tint="bg-emerald-50 text-emerald-600" />
            <Stat label="Harajat" value={`${money(s.total_cost)} so'm`} icon={Coins} tint="bg-amber-50 text-amber-600" />
            <Stat label="Foyda" value={`${money(s.total_profit)} so'm`} icon={TrendingUp} tint="bg-teal-50 text-teal-600" />
          </div>

          <div className="card overflow-hidden">
            <div className="px-4 py-3 font-semibold border-b border-slate-100">Do'konlar bo'yicha</div>
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50">
                  <th className="th">Do'kon</th>
                  <th className="th">Buyurtmalar</th>
                  <th className="th">Aylanma</th>
                  <th className="th">Harajat</th>
                  <th className="th">Foyda</th>
                </tr>
              </thead>
              <tbody>
                {s.stores.map((r) => (
                  <tr key={r.restaurant_id} className="hover:bg-slate-50/60">
                    <td className="td font-medium text-slate-900">{r.name}</td>
                    <td className="td font-semibold">{r.orders}</td>
                    <td className="td">{money(r.revenue)} so'm</td>
                    <td className="td">{money(r.cost)} so'm</td>
                    <td className="td text-emerald-600">{money(r.profit)} so'm</td>
                  </tr>
                ))}
                {s.stores.length === 0 && (
                  <tr><td colSpan={5} className="td text-center text-slate-400 py-10">Hali ma'lumot yo'q</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
