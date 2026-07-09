import { RefreshCw } from "lucide-react";

interface Props {
  title: string;
  subtitle?: string;
  loading?: boolean;
  onRefresh?: () => void;
}

export default function PageHeader({ title, subtitle, loading, onRefresh }: Props) {
  return (
    <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
      <div>
        <h1 className="text-base font-bold leading-tight">{title}</h1>
        {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
      </div>
      {onRefresh && (
        <button
          onClick={onRefresh}
          className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition"
          title="Yangilash"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
        </button>
      )}
    </header>
  );
}
