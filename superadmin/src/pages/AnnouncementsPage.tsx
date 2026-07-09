import { CircleCheck, CircleX, Megaphone, Plus, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { get, post } from "../api";
import ImageUpload from "../components/ImageUpload";
import { ErrorRetry, TableSkeleton } from "../components/Skeleton";
import type { Announcement, PlatformStats } from "../types";

const STATUS_LABEL: Record<Announcement["status"], string> = {
  pending: "Navbatda",
  sending: "Yuborilmoqda…",
  sent: "Yuborildi",
};

export default function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const [form, setForm] = useState<{ text: string; image_url: string | null; button_text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setErr(false);
    try {
      const [list, stats] = await Promise.all([
        get<Announcement[]>("/platform/announcements"),
        get<PlatformStats>("/platform/stats?period=all"),
      ]);
      setItems(list);
      setUsersTotal(stats.customers_total);
    } catch {
      setErr(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openForm = () => setForm({ text: "", image_url: null, button_text: "🛍 Ochish" });

  const save = async () => {
    if (!form || !form.text.trim() || saving) return;
    setSaving(true);
    try {
      await post("/platform/announcements", form);
      setForm(null);
      toast.success("Post yuborish boshlandi");
      load();
    } catch {
      toast.error("Yuborib bo'lmadi");
    } finally {
      setSaving(false);
    }
  };

  const resend = async (a: Announcement) => {
    try {
      await post(`/platform/announcements/${a.id}/resend`, {});
      toast.success("Qayta yuborish boshlandi");
      load();
    } catch {
      toast.error("Qayta yuborib bo'lmadi");
    }
  };

  const totalSent = items.reduce((s, a) => s + a.sent_count, 0);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-1">E'lonlar</h1>
      <p className="text-slate-500 mb-5">
        Botga rasmli/matnli post yuboring — tugma orqali ilova ochiladi.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <Card label="Jami postlar" value={String(items.length)} />
        <Card label="Jami yuborilgan xabar" value={String(totalSent)} />
        <Card label="Foydalanuvchilar" value={String(usersTotal)} />
      </div>

      <div className="flex justify-end mb-4">
        <button className="btn" onClick={openForm}>
          <Plus size={18} /> Yangi post
        </button>
      </div>

      {err ? <ErrorRetry onRetry={load} /> : loading ? <TableSkeleton cols={6} /> : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className="th">Sana</th>
                <th className="th">Post</th>
                <th className="th">Tugma</th>
                <th className="th">Holat</th>
                <th className="th">Yuborildi / Xato / Jami</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50/60">
                  <td className="td text-slate-500 text-sm">
                    {new Date(a.created_at).toLocaleString("ru-RU")}
                  </td>
                  <td className="td max-w-[260px]">
                    <div className="flex items-center gap-2">
                      {a.image_url && (
                        <img
                          src={a.image_url}
                          alt=""
                          className="h-10 w-10 rounded-lg object-cover bg-slate-100 shrink-0"
                        />
                      )}
                      <span className="truncate text-slate-700">{a.text}</span>
                    </div>
                  </td>
                  <td className="td text-sm">{a.button_text}</td>
                  <td className="td text-sm">{STATUS_LABEL[a.status]}</td>
                  <td className="td text-sm font-medium">
                    {a.sent_count} / {a.failed_count} / {a.total_recipients}
                  </td>
                  <td className="td text-right">
                    <button
                      className="icon-btn hover:text-brand"
                      title="Qayta yuborish"
                      onClick={() => resend(a)}
                    >
                      <RotateCcw size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="td text-center text-slate-400 py-10">
                    Hali post yuborilmagan
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="card p-6 w-[28rem] max-h-[90vh] overflow-auto space-y-3">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <Megaphone size={18} /> Yangi post
            </h2>

            <ImageUpload
              value={form.image_url}
              onChange={(url) => setForm({ ...form, image_url: url })}
              label="Rasm (ixtiyoriy)"
            />

            <label className="block">
              <span className="text-xs text-slate-500">Matn</span>
              <textarea
                className="input mt-1"
                rows={4}
                placeholder="Post matni..."
                value={form.text}
                onChange={(e) => setForm({ ...form, text: e.target.value })}
              />
            </label>

            <label className="block">
              <span className="text-xs text-slate-500">Tugma matni</span>
              <input
                className="input mt-1"
                value={form.button_text}
                onChange={(e) => setForm({ ...form, button_text: e.target.value })}
              />
            </label>

            <div className="flex gap-2 justify-end pt-2">
              <button className="btn-ghost" onClick={() => setForm(null)}>
                <CircleX size={16} /> Bekor
              </button>
              <button className="btn" onClick={save} disabled={!form.text.trim() || saving}>
                <CircleCheck size={16} /> Yuborish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-5">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="text-2xl font-bold mt-1 tracking-tight">{value}</div>
    </div>
  );
}
