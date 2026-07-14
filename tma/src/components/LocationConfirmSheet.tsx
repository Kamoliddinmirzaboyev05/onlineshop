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

      <div className="absolute bottom-0 inset-x-0 bg-tg-bg rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.1)] p-4 pb-6 space-y-3">
        <div className="flex items-start gap-3">
          <span className="h-10 w-10 shrink-0 rounded-xl bg-brand-light flex items-center justify-center text-brand">
            <MapPin size={18} />
          </span>
          <p className="text-sm leading-snug pt-1.5">
            {loading ? (lang === "uz" ? "Manzil aniqlanmoqda…" : "Определение адреса…") : address}
          </p>
        </div>
        <button
          onClick={() => onConfirm(center[0], center[1], address)}
          disabled={loading}
          className="btn-brand w-full disabled:opacity-60"
        >
          {lang === "uz" ? "Manzilni tasdiqlash" : "Подтвердить адрес"}
        </button>
      </div>
    </div>
  );
}
