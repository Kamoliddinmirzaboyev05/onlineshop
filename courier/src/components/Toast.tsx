import { AlertTriangle, Bell, CheckCircle2, Info, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

type ToastType = "success" | "error" | "info" | "push";

export interface ToastInput {
  title?: string;
  body: string;
  type?: ToastType;
  /** Where to go when the toast is tapped (push notifications). */
  url?: string;
  /** Auto-dismiss after ms. 0 = sticky. Default 4000. */
  duration?: number;
}

interface Toast extends ToastInput {
  id: number;
  type: ToastType;
}

interface ToastApi {
  show: (t: ToastInput) => void;
  success: (body: string, title?: string) => void;
  error: (body: string, title?: string) => void;
  info: (body: string, title?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 size={17} />,
  error: <AlertTriangle size={17} />,
  info: <Info size={17} />,
  push: <Bell size={17} />,
};

const BADGE: Record<ToastType, string> = {
  success: "bg-emerald-50 text-emerald-600",
  error: "bg-rose-50 text-rose-600",
  info: "bg-blue-50 text-blue-600",
  push: "bg-brand/10 text-brand",
};

export function ToastProvider({
  children,
  onToastClick,
}: {
  children: React.ReactNode;
  onToastClick?: (url: string) => void;
}) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (input: ToastInput) => {
      const id = ++idRef.current;
      const type = input.type ?? "info";
      const toast: Toast = { id, type, body: input.body, title: input.title, url: input.url };
      setToasts((list) => [...list.slice(-3), toast]); // cap stack at 4
      const duration = input.duration ?? 4000;
      if (duration > 0) setTimeout(() => dismiss(id), duration);
    },
    [dismiss]
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (body, title) => show({ body, title, type: "success" }),
      error: (body, title) => show({ body, title, type: "error" }),
      info: (body, title) => show({ body, title, type: "info" }),
    }),
    [show]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed top-0 inset-x-0 z-[70] flex flex-col items-center gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pointer-events-none">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: -24, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 500, damping: 34 }}
              onClick={() => {
                if (t.url && onToastClick) onToastClick(t.url);
                dismiss(t.id);
              }}
              className={`pointer-events-auto w-full max-w-md flex items-start gap-3 bg-white rounded-2xl shadow-lg shadow-slate-900/10 px-4 py-3.5 ${
                t.url ? "cursor-pointer active:scale-[0.98]" : ""
              }`}
            >
              <span className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${BADGE[t.type]}`}>
                {ICONS[t.type]}
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                {t.title && <div className="text-sm font-semibold leading-tight text-slate-900">{t.title}</div>}
                <div className="text-sm text-slate-500 leading-snug">{t.body}</div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  dismiss(t.id);
                }}
                className="shrink-0 text-slate-300 hover:text-slate-500 -mr-1 -mt-0.5 p-1"
                aria-label="Yopish"
              >
                <X size={15} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
