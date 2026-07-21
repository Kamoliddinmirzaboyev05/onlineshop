import { BarChart3, LayoutDashboard, Menu, Package, ReceiptText } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NavLink } from "react-router-dom";

const TABS: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: "/", label: "Umumiy", icon: LayoutDashboard, end: true },
  { to: "/reports", label: "Hisobot", icon: BarChart3 },
  { to: "/orders", label: "Buyurtma", icon: ReceiptText },
  { to: "/products", label: "Mahsulot", icon: Package },
];

// Asosiy sahifalar uchun mobil pastki navigatsiya. Qolgan bo'limlar (Do'konlar,
// Ombor, Mijozlar, Xodimlar, Sozlamalar) "Ko'proq" orqali sidebar drawer'ni ochadi.
export default function BottomNav({ onMore }: { onMore: () => void }) {
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${
                isActive ? "text-brand" : "text-slate-400"
              }`
            }
          >
            <Icon size={20} />
            {label}
          </NavLink>
        ))}
        <button
          onClick={onMore}
          className="flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium text-slate-400"
        >
          <Menu size={20} />
          Ko'proq
        </button>
      </div>
    </nav>
  );
}
