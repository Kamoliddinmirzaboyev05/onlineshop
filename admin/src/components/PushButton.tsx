import { Bell, BellOff, BellRing } from "lucide-react";
import { useEffect, useState } from "react";
import { enablePush, notifPermission, pushSupported } from "../push";

export default function PushButton() {
  const [perm, setPerm] = useState<NotificationPermission>(notifPermission());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);

  // A browser-side grant/deny (e.g. via the site settings) won't fire a React
  // event — re-sync the permission on mount and whenever the tab regains focus.
  useEffect(() => {
    const sync = () => setPerm(notifPermission());
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  if (!pushSupported()) return null;

  if (perm === "granted") {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-xs text-emerald-600">
        <BellRing size={14} /> Bildirishnoma yoniq
      </div>
    );
  }

  return (
    <div>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr(false);
          try {
            setPerm(await enablePush());
          } catch {
            setErr(true);
            setPerm(notifPermission());
          } finally {
            setBusy(false);
          }
        }}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition disabled:opacity-50"
      >
        {perm === "denied" ? <BellOff size={16} /> : <Bell size={16} />}
        {perm === "denied" ? "Bildirishnoma bloklangan" : busy ? "..." : "Bildirishnomani yoqish"}
      </button>
      {err && <p className="px-3 pt-1 text-xs text-red-500">Bildirishnomani yoqib bo'lmadi</p>}
    </div>
  );
}
