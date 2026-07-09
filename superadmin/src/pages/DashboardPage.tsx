import { Building2, Coins, ReceiptText, Store, TrendingUp, Users, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { get } from "../api";
import { ErrorRetry, StatCardsSkeleton } from "../components/Skeleton";
import type { PlatformStats, StatsPeriod } from "../types";

const money = (n: number) => n.toLocaleString("ru-RU").replace(/,/g, " ");

const PERIODS: { value: StatsPeriod; label: string }[] = [
  { value: "today", label: "Bugun" },
  { value: "week", label: "Hafta" },
  { value: "month", label: "Oy" },
  { value: "all", label: "Butun davr" },
];

function Stat({
  label, value, icon: Icon, tint,
}: { label: string; value: string; icon: LucideIcon; tint: string }) {
  return (
    <div className="card p-5 flex items-start justify-between">
      <div className="min-w-0">
        <div className="text-sm text-slate-500">{label}</div>
        <div className="text-2xl font-bold mt-1 tracking-tight truncate">{value}</div>
      </div>
      <span className={`grid place-items-center h-10 w-10 rounded-lg shrink-0 ml-2 ${tint}`}>
        <Icon size={20} />
      </span>
    </div>
  );
}

export default function DashboardPage() {
  const [period, setPeriod] = useState<StatsPeriod>("month");
  const [s, setS] = useState<PlatformStats | null>(null);
  const [err, setErr] = useState(false);

  const load = (p: StatsPeriod) => {
    setErr(false);
    setS(null);
    get<PlatformStats>(`/platform/stats?period=${p}`).then(setS).catch(() => setErr(true));
  };

  useEffect(() => { load(period); }, [period]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Umumiy</h1>
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${
                period === p.value ? "bg-brand text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {err && !s ? <ErrorRetry onRetry={() => load(period)} /> : !s ? <StatCardsSkeleton count={7} /> : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat label="Tadbirkorlar" value={String(s.businesses_total)} icon={Building2} tint="bg-violet-50 text-violet-600" />
            <Stat label="Do'konlar" value={String(s.stores_total)} icon={Store} tint="bg-indigo-50 text-indigo-600" />
            <Stat label="Mijozlar" value={String(s.customers_total)} icon={Users} tint="bg-sky-50 text-sky-600" />
            <Stat label="Buyurtmalar" value={String(s.total_orders)} icon={ReceiptText} tint="bg-cyan-50 text-cyan-600" />
            <Stat label="Aylanma" value={`${money(s.total_revenue)} so'm`} icon={Wallet} tint="bg-emerald-50 text-emerald-600" />
            <Stat label="Harajat" value={`${money(s.total_cost)} so'm`} icon={Coins} tint="bg-amber-50 text-amber-600" />
            <Stat label="Foyda" value={`${money(s.total_profit)} so'm`} icon={TrendingUp} tint="bg-teal-50 text-teal-600" />
          </div>

          <div className="card overflow-hidden">
            <div className="px-4 py-3 font-semibold border-b border-slate-100">Tadbirkorlar bo'yicha</div>
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50">
                  <th className="th">Tadbirkor</th>
                  <th className="th">Do'konlar</th>
                  <th className="th">Buyurtmalar</th>
                  <th className="th">Aylanma</th>
                  <th className="th">Harajat</th>
                  <th className="th">Foyda</th>
                </tr>
              </thead>
              <tbody>
                {s.businesses.map((r) => (
                  <tr key={r.business_id} className="hover:bg-slate-50/60">
                    <td className="td font-medium text-slate-900">{r.name}</td>
                    <td className="td">{r.stores}</td>
                    <td className="td font-semibold">{r.orders}</td>
                    <td className="td">{money(r.revenue)} so'm</td>
                    <td className="td">{money(r.cost)} so'm</td>
                    <td className="td text-emerald-600">{money(r.profit)} so'm</td>
                  </tr>
                ))}
                {s.businesses.length === 0 && (
                  <tr><td colSpan={6} className="td text-center text-slate-400 py-10">Hali ma'lumot yo'q</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
