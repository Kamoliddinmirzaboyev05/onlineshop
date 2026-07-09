import { AlertTriangle, CircleHelp } from "lucide-react";
import { useEffect } from "react";
import { create } from "zustand";

export interface ConfirmOptions {
  title: string;
  /** Qo'shimcha izoh (ixtiyoriy). */
  message?: string;
  confirmText?: string;
  cancelText?: string;
  /** Xavfli amal (o'chirish) — qizil tugma va ogohlantirish ikonkasi. */
  danger?: boolean;
}

interface ConfirmState {
  open: boolean;
  opts: ConfirmOptions | null;
  resolve: ((ok: boolean) => void) | null;
  ask: (opts: ConfirmOptions) => Promise<boolean>;
  close: (ok: boolean) => void;
}

const useConfirmStore = create<ConfirmState>((set, get) => ({
  open: false,
  opts: null,
  resolve: null,
  ask: (opts) =>
    new Promise<boolean>((resolve) => {
      set({ open: true, opts, resolve });
    }),
  close: (ok) => {
    get().resolve?.(ok);
    set({ open: false, resolve: null });
  },
}));

/**
 * Imperativ tasdiqlash modali — `window.confirm` o'rniga.
 *
 *   if (await confirm({ title: "O'chirasizmi?", danger: true })) { ... }
 */
export function confirm(opts: ConfirmOptions): Promise<boolean> {
  return useConfirmStore.getState().ask(opts);
}

/** Ilovaga bir marta joylashtiriladigan modal host (App ichida). */
export function ConfirmHost() {
  const { open, opts, close } = useConfirmStore();

  // Esc — bekor, Enter — tasdiqlash.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
      if (e.key === "Enter") close(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open || !opts) return null;

  const danger = opts.danger;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-[fade_.12s_ease-out]"
      onClick={() => close(false)}
    >
      <div
        className="card w-full max-w-sm p-6 text-center space-y-4 animate-[pop_.14s_ease-out]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <span
          className={`grid place-items-center h-14 w-14 mx-auto rounded-2xl ${
            danger ? "bg-rose-50 text-rose-600" : "bg-brand/10 text-brand"
          }`}
        >
          {danger ? <AlertTriangle size={28} /> : <CircleHelp size={28} />}
        </span>

        <div>
          <h2 className="text-lg font-bold tracking-tight">{opts.title}</h2>
          {opts.message && (
            <p className="text-sm text-slate-500 mt-1 whitespace-pre-line">{opts.message}</p>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <button className="btn-ghost flex-1 justify-center" onClick={() => close(false)}>
            {opts.cancelText ?? "Bekor"}
          </button>
          <button
            autoFocus
            className={`flex-1 justify-center inline-flex items-center gap-2 font-medium rounded-lg px-4 py-2 shadow-sm text-white transition active:scale-[.98] ${
              danger ? "bg-rose-600 hover:bg-rose-700" : "bg-brand hover:bg-brand-dark"
            }`}
            onClick={() => close(true)}
          >
            {opts.confirmText ?? "Tasdiqlash"}
          </button>
        </div>
      </div>
    </div>
  );
}
