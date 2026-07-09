import { Bell, CheckCircle2, PackageCheck, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { get } from "../api";
import type { NotificationEvent } from "../types";

const SEEN_KEY = "af_admin_notif_last_seen";

const ICON: Record<NotificationEvent["type"], typeof Bell> = {
  new: Sparkles,
  accepted: CheckCircle2,
  delivered: PackageCheck,
};

const LABEL: Record<NotificationEvent["type"], string> = {
  new: "Yangi buyurtma",
  accepted: "Qabul qilindi",
  delivered: "Yetkazildi",
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "hozir";
  if (min < 60) return `${min} daq oldin`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} soat oldin`;
  return `${Math.floor(hr / 24)} kun oldin`;
}

export default function NotificationBell() {
  const [events, setEvents] = useState<NotificationEvent[]>([]);
  const [open, setOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState(
    () => localStorage.getItem(SEEN_KEY) ?? new Date().toISOString(),
  );
  const boxRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      setEvents(await get<NotificationEvent[]>("/admin/notifications"));
    } catch {
      // silent — bell just won't update this poll cycle
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const unseen = events.filter((e) => e.at > lastSeen).length;

  const toggle = () => {
    setOpen((o) => !o);
    if (!open && events.length) {
      const newest = events[0].at;
      setLastSeen(newest);
      localStorage.setItem(SEEN_KEY, newest);
    }
  };

  return (
    <div className="relative" ref={boxRef}>
      <button
        className="icon-btn relative"
        onClick={toggle}
        aria-label="Bildirishnomalar"
      >
        <Bell size={20} />
        {unseen > 0 && (
          <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold grid place-items-center">
            {unseen > 9 ? "9+" : unseen}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-auto card p-2 z-50 shadow-lg">
          {events.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">Hozircha faoliyat yo'q</p>
          )}
          {events.map((e, i) => {
            const Icon = ICON[e.type];
            return (
              <div
                key={`${e.order_id}-${e.type}-${i}`}
                className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50"
              >
                <span className="grid place-items-center h-8 w-8 rounded-lg bg-brand/10 text-brand shrink-0">
                  <Icon size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-800">
                    {LABEL[e.type]} · № {e.order_number}
                  </div>
                  <div className="text-xs text-slate-500 truncate">{e.address_line}</div>
                </div>
                <span className="text-xs text-slate-400 shrink-0">{timeAgo(e.at)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
