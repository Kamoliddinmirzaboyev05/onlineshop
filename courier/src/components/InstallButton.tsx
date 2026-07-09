import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { isStandalone } from "../push";

/** Chrome/Edge fire this instead of letting the browser show its own install
 * banner, when the page calls preventDefault() on it — not in lib.dom yet. */
interface BeforeInstallPromptEvent extends Event {
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
    appinstalled: Event;
  }
}

/** "Ilovani o'rnatish" tugmasi — faqat brauzer beforeinstallprompt bersa
 * ko'rinadi (Chrome/Edge/Android), allaqachon o'rnatilgan bo'lsa yashirin. */
export default function InstallButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone());

  useEffect(() => {
    if (installed) return;

    const onPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferred(e);
    };
    const onInstalled = () => {
      setDeferred(null);
      setInstalled(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [installed]);

  if (installed || !deferred) return null;

  const install = async () => {
    const captured = deferred;
    setDeferred(null); // one-shot — a captured prompt can't be reused
    await captured.prompt();
    const choice = await captured.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
  };

  return (
    <button
      onClick={install}
      className="w-full py-3 rounded-2xl border border-slate-200 text-slate-600 text-sm font-semibold flex items-center justify-center gap-2 active:scale-95 transition"
    >
      <Download size={16} /> Ilovani o'rnatish
    </button>
  );
}
