import { History, House, Search, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useI18n } from "../i18n";

const base =
  "flex flex-col items-center justify-center gap-1 flex-1 py-2 text-[11px] font-medium transition";

export default function BottomNav() {
  const { t } = useI18n();

  const item = (to: string, label: string, Icon: LucideIcon) => (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        `${base} ${isActive ? "text-brand" : "text-tg-hint"}`
      }
    >
      <Icon size={22} />
      {label}
    </NavLink>
  );

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-tg-bg border-t border-black/10 flex pb-[env(safe-area-inset-bottom)]">
      {item("/", t.home, House)}
      {item("/search", t.search_tab, Search)}
      {item("/orders", t.orders, History)}
      {item("/profile", t.profile, User)}
    </nav>
  );
}
