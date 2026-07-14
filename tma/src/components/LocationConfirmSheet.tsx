import "leaflet/dist/leaflet.css";
import { LocateFixed, MapPin, X } from "lucide-react";
import { useEffect, useState } from "react";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { reverseGeocode } from "../lib/geocode";

// Default: Farg'ona shahar markazi.
const DEFAULT_CENTER: [number, number] = [40.3864, 71.7864];

function MoveTracker({ onMoveEnd }: { onMoveEnd: (lat: number, lng: number) => void }) {
  const map = useMapEvents({
    moveend() {
      const c = map.getCenter();
      onMoveEnd(c.lat, c.lng);
    },
  });
  return null;
}

function Recenter({ point }: { point: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(point, Math.max(map.getZoom(), 16));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [point[0], point[1]]);
  return null;
}

interface Props {
  initial: { lat: number; lng: number } | null;
  lang: "uz" | "ru";
  onConfirm: (lat: number, lng: number, address: string) => void;
  onClose: () => void;
}

/** Xaritani markaziy nuqta ustida sudrab, do'kon/kuryer uchun yetkazish
 * manzilini tasdiqlash — to'liq ekranli qatlam (native map picker uslubida). */
export default function LocationConfirmSheet({ initial, lang, onConfirm, onClose }: Props) {
  const [center, setCenter] = useState<[number, number]>(
    initial ? [initial.lat, initial.lng] : DEFAULT_CENTER
  );
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);

  const geocode = (lat: number, lng: number) => {
    setLoading(true);
    reverseGeocode(lat, lng)
      .then((a) => setAddress(a ?? `📍 ${lat.toFixed(5)}, ${lng.toFixed(5)}`))
      .finally(() => setLoading(false));
  };

  const locate = () => {
    if (!navigator.geolocation) {
      geocode(center[0], center[1]);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const point: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setCenter(point);
        geocode(point[0], point[1]);
      },
      () => geocode(center[0], center[1]),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Ochilganda: avval belgilangan nuqta bo'lsa shuni geokodlaymiz, aks holda
  // qurilma joylashuvini avtomatik so'raymiz (foydalanuvchi picker'ni ochganda,
  // sahifa yuklanishida emas — ortiqcha ruxsat so'rovi bo'lmasligi uchun).
  useEffect(() => {
    if (initial) geocode(center[0], center[1]);
    else locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-tg-bg">
      <MapContainer center={center} zoom={15} style={{ height: "100%", width: "100%" }} zoomControl={false}>
        <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MoveTracker onMoveEnd={(lat, lng) => { setCenter([lat, lng]); geocode(lat, lng); }} />
        <Recenter point={center} />
      </MapContainer>

      {/* Markazda qotib turuvchi pin — xarita uning ostida suriladi */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center -translate-y-4">
        <MapPin size={40} className="text-brand drop-shadow-lg" fill="currentColor" fillOpacity={0.15} />
      </div>

      <button
        onClick={onClose}
        className="absolute top-4 left-4 h-10 w-10 rounded-full bg-white shadow-md flex items-center justify-center active:scale-90 transition"
      >
        <X size={20} />
      </button>

      <button
        onClick={locate}
        className="absolute top-4 right-4 h-10 w-10 rounded-full bg-brand text-white shadow-md flex items-center justify-center active:scale-90 transition"
      >
        <LocateFixed size={18} />
      </button>

      <div className="absolute bottom-0 inset-x-0 bg-white rounded-t-[32px] shadow-[0_-4px_24px_rgba(0,0,0,0.08)] p-5 pb-8 flex flex-col gap-6 z-20">
        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto -mt-2" />
        
        <div className="flex items-center gap-4">
          <div className="h-[60px] w-[60px] shrink-0 rounded-[20px] bg-[#FFF0E5] flex items-center justify-center text-[#FF6B00]">
            <MapPin size={26} fill="currentColor" strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[18px] font-bold text-slate-900 leading-snug line-clamp-2">
              {loading ? (lang === "uz" ? "Manzil aniqlanmoqda…" : "Определение адреса…") : address || "..."}
            </h3>
            {!loading && address && (
              <p className="text-[#FF6B00] text-[11px] font-bold uppercase tracking-wider mt-1.5 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#FF6B00]" />
                {address.split(",").pop()?.trim() || (lang === "uz" ? "O'zbekiston" : "Узбекистан")}
              </p>
            )}
          </div>
        </div>
        
        <button
          onClick={() => onConfirm(center[0], center[1], address)}
          disabled={loading}
          className="w-full bg-[#121822] text-white font-semibold text-lg py-4 rounded-[20px] active:scale-95 transition disabled:opacity-60"
        >
          {lang === "uz" ? "Manzilni tasdiqlash" : "Подтвердить адрес"}
        </button>
      </div>
    </div>
  );
}
