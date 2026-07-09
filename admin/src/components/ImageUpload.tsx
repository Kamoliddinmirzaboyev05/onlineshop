import { ImagePlus, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";
import { uploadImage } from "../api";

interface Props {
  value?: string | null;
  onChange: (url: string | null) => void;
  /** Preview balandligi (Tailwind), masalan "h-24" yoki "h-32". */
  heightClass?: string;
  label?: string;
}

/** Qurilmadan rasm tanlab yuklaydi, URL ni qaytaradi. */
export default function ImageUpload({
  value,
  onChange,
  heightClass = "h-32",
  label = "Rasm",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const pick = async (file?: File) => {
    if (!file) return;
    setErr(null);
    setBusy(true);
    try {
      const url = await uploadImage(file);
      onChange(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message.slice(0, 80) : "Yuklashda xatolik");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <span className="text-xs text-slate-500">{label}</span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0])}
      />

      {value ? (
        <div className="relative mt-1 group">
          <img
            src={value}
            alt=""
            className={`${heightClass} w-full rounded-lg object-cover bg-slate-100 border border-slate-200`}
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute top-2 right-2 h-7 w-7 rounded-full bg-slate-900/60 text-white flex items-center justify-center hover:bg-slate-900/80 transition"
            title="O'chirish"
          >
            <X size={15} />
          </button>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="absolute bottom-2 right-2 text-xs bg-white/90 text-slate-700 rounded-md px-2 py-1 shadow-sm hover:bg-white transition"
          >
            O'zgartirish
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className={`${heightClass} mt-1 w-full rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-brand text-slate-500 flex flex-col items-center justify-center gap-1 transition disabled:opacity-60`}
        >
          {busy ? (
            <Loader2 size={22} className="animate-spin" />
          ) : (
            <ImagePlus size={22} />
          )}
          <span className="text-xs">{busy ? "Yuklanmoqda…" : "Rasm tanlash"}</span>
        </button>
      )}

      {err && <p className="text-xs text-rose-600 mt-1">{err}</p>}
    </div>
  );
}
