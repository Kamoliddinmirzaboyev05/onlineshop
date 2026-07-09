import { Bell, BellOff, BellRing, Share } from "lucide-react";
import { useEffect, useState } from "react";
import { enablePush, isIOS, isStandalone, notifPermission, pushSupported } from "../push";

export default function PushButton() {
  const [perm, setPerm] = useState<NotificationPermission>(notifPermission());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);

  useEffect(() => {
    const sync = () => setPerm(notifPermission());
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  // iOS Safari'da PushManager faqat Home Screen'ga o'rnatilgan (standalone)
  // holatda mavjud bo'ladi — oddiy tab'da pushSupported() har doim false,
  // shu sabab foydalanuvchiga o'rnatish yo'lini ko'rsatamiz.
  if (isIOS() && !isStandalone()) {
    return (
      <div className="py-3 text-sm text-slate-500 flex items-start gap-2">
        <Share size={16} className="shrink-0 mt-0.5 text-brand" />
        <span>
          Bildirishnoma olish uchun: pastdagi <b>Share</b> tugmasi →{" "}
          <b>"Add to Home Screen"</b> orqali ilovani o'rnating.
        </span>
      </div>
    );
  }

  if (!pushSupported()) return null;

  if (perm === "granted") {
    return (
      <div className="flex items-center justify-center gap-2 py-3 text-sm text-emerald-600 font-medium">
        <BellRing size={16} /> Bildirishnoma yoniq
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
        className="w-full py-3 rounded-2xl border border-slate-200 text-slate-600 text-sm font-semibold flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-50"
      >
        {perm === "denied" ? <BellOff size={16} /> : <Bell size={16} />}
        {perm === "denied" ? "Bildirishnoma bloklangan" : busy ? "..." : "Bildirishnomani yoqish"}
      </button>
      {err && <p className="pt-1 text-xs text-red-500 text-center">Bildirishnomani yoqib bo'lmadi</p>}
    </div>
  );
}
