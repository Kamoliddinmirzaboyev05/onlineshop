import { Bold, Italic, Send, Store, Underline } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { post, withStore } from "../api";
import ImageUpload from "../components/ImageUpload";
import { useStore } from "../store";

/** Tanlangan matnni HTML tegi bilan o'raydi (Telegram parse_mode=HTML). */
function wrapSelection(
  textarea: HTMLTextAreaElement,
  text: string,
  setText: (v: string) => void,
  tag: string,
) {
  const { selectionStart: s, selectionEnd: e } = textarea;
  const selected = text.slice(s, e) || "matn";
  const next = `${text.slice(0, s)}<${tag}>${selected}</${tag}>${text.slice(e)}`;
  setText(next);
  requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(s + tag.length + 2, s + tag.length + 2 + selected.length);
  });
}

export default function PostPage() {
  const storeId = useStore((s) => s.selectedStoreId);
  const stores = useStore((s) => s.stores);
  const isAll = storeId === "all";

  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [targetStoreId, setTargetStoreId] = useState<number | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const effectiveStoreId = isAll ? targetStoreId : (storeId as number | null);

  const toolbar = (tag: string) => {
    if (!taRef.current) return;
    wrapSelection(taRef.current, text, setText, tag);
  };

  const send = async () => {
    if ((!text.trim() && !imageUrl) || !effectiveStoreId) return;
    setSending(true);
    try {
      const { sent_to } = await post<{ sent_to: number }>(
        withStore("/admin/broadcast", effectiveStoreId),
        { text: text.trim(), image_url: imageUrl },
      );
      toast.success(`Yuborildi — ${sent_to} mijozga`);
      setText("");
      setImageUrl(null);
    } catch (e) {
      toast.error(String(e).replace("Error: ", ""));
    } finally {
      setSending(false);
    }
  };

  if (storeId == null) {
    return (
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-1">Post</h1>
        <div className="card p-10 text-center text-slate-400 mt-5">
          <Store size={32} className="mx-auto mb-3 opacity-30" />
          Avval "Do'konlar" bo'limida do'kon yarating, so'ng yuqoridagi ro'yxatdan tanlang
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-1">Post</h1>
      <p className="text-slate-500 mb-5">
        Botga buyurtma bergan mijozlaringizga xabar yuboring — rasm, matn yoki ikkalasi.
      </p>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ── FORM ── */}
        <div className="card p-5 space-y-4">
          {isAll && (
            <label className="block">
              <span className="text-xs text-slate-500">Do'kon</span>
              <select
                className="input mt-1"
                value={targetStoreId ?? ""}
                onChange={(e) => setTargetStoreId(Number(e.target.value) || null)}
              >
                <option value="">Tanlang...</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
          )}

          <ImageUpload value={imageUrl} onChange={setImageUrl} heightClass="h-44" label="Rasm (ixtiyoriy)" />

          <div>
            <div className="flex items-center gap-1 mb-1">
              <span className="text-xs text-slate-500 mr-2">Matn</span>
              <button type="button" className="icon-btn" title="Qalin" onClick={() => toolbar("b")}>
                <Bold size={15} />
              </button>
              <button type="button" className="icon-btn" title="Kursiv" onClick={() => toolbar("i")}>
                <Italic size={15} />
              </button>
              <button type="button" className="icon-btn" title="Tagi chizilgan" onClick={() => toolbar("u")}>
                <Underline size={15} />
              </button>
            </div>
            <textarea
              ref={taRef}
              className="input min-h-40 resize-y"
              placeholder="Yangi aksiya, chegirma yoki e'lon matni..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>

          <button
            className="btn w-full justify-center"
            onClick={send}
            disabled={sending || (!text.trim() && !imageUrl) || !effectiveStoreId}
          >
            <Send size={16} /> {sending ? "Yuborilmoqda..." : "Yuborish"}
          </button>
        </div>

        {/* ── PREVIEW ── */}
        <div className="card p-5">
          <span className="text-xs text-slate-500">Ko'rinishi</span>
          <div className="mt-2 rounded-2xl bg-sky-50 border border-sky-100 p-3 max-w-sm">
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              {imageUrl && <img src={imageUrl} alt="" className="w-full max-h-64 object-cover" />}
              <div
                className="p-3 text-sm whitespace-pre-wrap break-words text-slate-800"
                dangerouslySetInnerHTML={{ __html: text.trim() || '<span class="text-slate-300">Xabar shu yerda ko\'rinadi...</span>' }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
