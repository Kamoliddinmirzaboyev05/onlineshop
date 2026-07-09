import { BarChart3, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { get } from "../api";
import { ErrorRetry, StatCardsSkeleton } from "../components/Skeleton";
import type { PeriodPoint, ReportsOut } from "../types";

const money = (n: number) => n.toLocaleString("ru-RU").replace(/,/g, " ");

type Period = "daily" | "weekly" | "monthly";
const TABS: { key: Period; label: string }[] = [
  { key: "daily", label: "Kunlik" },
  { key: "weekly", label: "Haftalik" },
  { key: "monthly", label: "Oylik" },
];

function fmtLabel(iso: string, period: Period) {
  const d = new Date(iso);
  if (period === "monthly") return d.toLocaleDateString("ru-RU", { month: "short", year: "2-digit" });
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportsOut | null>(null);
  const [period, setPeriod] = useState<Period>("daily");
  const [err, setErr] = useState(false);

  const load = () => {
    setErr(false);
    get<ReportsOut>("/admin/reports").then(setData).catch(() => setErr(true));
  };

  useEffect(() => { load(); }, []);

  if (!data) {
    return (
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-1">Hisobot</h1>
        <p className="text-slate-500 mb-6">Savdo, foyda va mahsulot reytinglari</p>
        {err ? <ErrorRetry onRetry={load} /> : <StatCardsSkeleton count={3} />}
      </div>
    );
  }

  const rows: PeriodPoint[] = data[period];
  const totRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totProfit = rows.reduce((s, r) => s + r.profit, 0);
  const totOrders = rows.reduce((s, r) => s + r.orders, 0);
  const maxRevenue = Math.max(1, ...rows.map((r) => r.revenue));
  const maxQty = Math.max(1, ...data.top_products.map((t) => t.quantity));

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-1">Hisobot</h1>
      <p className="text-slate-500 mb-6">Savdo, foyda va mahsulot reytinglari</p>

      <div className="flex gap-2 mb-5">
        {TABS.map((t) => (
          <button key={t.key}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${period === t.key ? "bg-brand text-white shadow-sm" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
            onClick={() => setPeriod(t.key)}>{t.label}</button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card p-5">
          <div className="text-sm text-slate-500">Buyurtmalar</div>
          <div className="text-2xl font-bold mt-1">{money(totOrders)}</div>
        </div>
        <div className="card p-5">
          <div className="text-sm text-slate-500">Tushum</div>
          <div className="text-2xl font-bold mt-1">{money(totRevenue)} <span className="text-sm text-slate-400">so'm</span></div>
        </div>
        <div className="card p-5">
          <div className="text-sm text-slate-500">Foyda</div>
          <div className="text-2xl font-bold mt-1 text-emerald-600">{money(totProfit)} <span className="text-sm text-slate-400">so'm</span></div>
        </div>
      </div>

      {/* ── Bar chart ─────────────────────────────────────── */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-2 mb-4 font-semibold"><BarChart3 size={18} /> Savdo dinamikasi</div>
        {rows.length === 0 ? (
          <div className="text-center text-slate-400 py-10">Ma'lumot yo'q</div>
        ) : (
          <div className="flex items-end gap-1.5 h-48 overflow-x-auto">
            {rows.map((r) => (
              <div key={r.period} className="flex-1 min-w-[14px] flex flex-col items-center justify-end group h-full">
                <div className="relative w-full flex flex-col items-center justify-end h-full">
                  <div className="hidden group-hover:block absolute -top-1 -translate-y-full bg-slate-900 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap z-10">
                    {money(r.revenue)} • foyda {money(r.profit)}
                  </div>
                  <div className="w-full bg-brand/80 rounded-t" style={{ height: `${(r.revenue / maxRevenue) * 100}%` }} />
                </div>
                <span className="text-[9px] text-slate-400 mt-1 rotate-0 whitespace-nowrap">{fmtLabel(r.period, period)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Period table ──────────────────────────────────── */}
      <div className="card overflow-hidden mb-6">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50">
              <th className="th">Davr</th>
              <th className="th">Buyurtma</th>
              <th className="th">Tushum</th>
              <th className="th">Foyda</th>
            </tr>
          </thead>
          <tbody>
            {[...rows].reverse().map((r) => (
              <tr key={r.period} className="hover:bg-slate-50/60">
                <td className="td font-medium">{fmtLabel(r.period, period)}</td>
                <td className="td">{r.orders}</td>
                <td className="td">{money(r.revenue)} so'm</td>
                <td className="td text-emerald-600 font-medium">{money(r.profit)} so'm</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="td text-center text-slate-400 py-8">Ma'lumot yo'q</td></tr>}
          </tbody>
        </table>
      </div>

      {/* ── Top products ──────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 font-semibold border-b border-slate-100"><Star size={18} className="text-amber-500" /> Sotilgan mahsulotlar reytingi</div>
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50">
              <th className="th">#</th>
              <th className="th">Mahsulot</th>
              <th className="th">Sotildi</th>
              <th className="th">Tushum</th>
              <th className="th">Foyda</th>
            </tr>
          </thead>
          <tbody>
            {data.top_products.map((t, i) => (
              <tr key={t.product_id} className="hover:bg-slate-50/60">
                <td className="td text-slate-400 font-semibold">{i + 1}</td>
                <td className="td font-medium text-slate-900">
                  <div className="flex items-center gap-3">
                    {t.image_url
                      ? <img src={t.image_url} alt="" className="h-8 w-8 rounded-lg object-cover bg-slate-100" />
                      : <span className="h-8 w-8 rounded-lg bg-slate-100" />}
                    <div className="min-w-0 flex-1">
                      <div>{t.name_uz}</div>
                      <div className="h-1.5 mt-1 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(t.quantity / maxQty) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                </td>
                <td className="td font-semibold">{t.quantity}</td>
                <td className="td">{money(t.revenue)} so'm</td>
                <td className="td text-emerald-600">{money(t.profit)} so'm</td>
              </tr>
            ))}
            {data.top_products.length === 0 && (
              <tr><td colSpan={5} className="td text-center text-slate-400 py-10">Hali sotuv yo'q</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
