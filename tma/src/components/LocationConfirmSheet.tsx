import "leaflet/dist/leaflet.css";
import { LocateFixed, MapPin, X } from "lucide-react";
import { useEffect, useState } from "react";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { reverseGeocode } from "../lib/geocode";
import { canOpenTelegramLocationSettings, getTelegramLocation, openTelegramLocationSettings } from "../telegram";

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

// `tick` faqat DASTURIY markazlashda (GPS natijasi/boshlang'ich nuqta)
// oshiriladi — foydalanuvchi xaritani qo'lda surganda EMAS. Aks holda har bir
// sudrashdan keyin setView xaritani zo'rlab qayta markazlashtirib, foydalanuvchi
// harakati bilan "jang qiladi" (surish ishlamayotgandek tuyuladi).
function Recenter({ point, tick }: { point: [number, number]; tick: number }) {
  const map = useMap();
  useEffect(() => {
    if (tick === 0) return;
    map.setView(point, Math.max(map.getZoom(), 16));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);
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
  // GPS muvaffaqiyatsiz bo'lsa DEFAULT_CENTER manzilini xuddi haqiqiy
  // joylashuvdek ko'rsatmaslik uchun — foydalanuvchi xaritani qo'lda surishi kerakligini bildiradi.
  const [locationFailed, setLocationFailed] = useState(false);
  const [recenterTick, setRecenterTick] = useState(0);

  const geocode = (lat: number, lng: number) => {
    setLoading(true);
    reverseGeocode(lat, lng)
      .then((a) => setAddress(a ?? `📍 ${lat.toFixed(5)}, ${lng.toFixed(5)}`))
      .finally(() => setLoading(false));
  };

  const locate = async () => {
    setLocationFailed(false);

    // Avval Telegram'ning o'z joylashuv menejeri (Bot API 8.0+) — ba'zi
    // Telegram WebView'larda brauzer Geolocation ruxsat prompt'ini
    // ko'rsatmasdan darhol xato beradi, Telegram'niki ishonchliroq.
    const tgLoc = await getTelegramLocation();
    if (tgLoc) {
      setCenter([tgLoc.lat, tgLoc.lng]);
      setRecenterTick((t) => t + 1);
      geocode(tgLoc.lat, tgLoc.lng);
      return;
    }

    if (!navigator.geolocation) {
      setLocationFailed(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const point: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setCenter(point);
        setRecenterTick((t) => t + 1);
        geocode(point[0], point[1]);
      },
      () => setLocationFailed(true),
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
        <MoveTracker onMoveEnd={(lat, lng) => { setCenter([lat, lng]); setLocationFailed(false); geocode(lat, lng); }} />
        <Recenter point={center} tick={recenterTick} />
      </MapContainer>

      {/* Markazda qotib turuvchi pin — xarita uning ostida suriladi */}
      <div className="pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center -translate-y-4">
        <MapPin size={46} className="text-[#FF6B00] drop-shadow-md" fill="currentColor" />
      </div>

      <button
        onClick={onClose}
        className="absolute top-4 left-4 z-[1000] h-11 w-11 rounded-full bg-white shadow-md flex items-center justify-center active:scale-90 transition text-slate-700"
      >
        <X size={24} />
      </button>

      <button
        onClick={locate}
        className="absolute top-4 right-4 z-[1000] h-11 w-11 rounded-full bg-white text-slate-700 shadow-md flex items-center justify-center active:scale-90 transition"
      >
        <LocateFixed size={22} />
      </button>

      <div className="absolute bottom-0 inset-x-0 z-[1000] bg-white rounded-t-[32px] shadow-[0_-4px_24px_rgba(0,0,0,0.08)] p-5 pb-8 flex flex-col gap-6">
        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto -mt-2" />
        
        <div className="flex items-center gap-4">
          <div className="h-[60px] w-[60px] shrink-0 rounded-[20px] bg-[#FFF0E5] flex items-center justify-center text-[#FF6B00]">
            <MapPin size={26} fill="currentColor" strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[18px] font-bold text-slate-900 leading-snug line-clamp-2">
              {loading
                ? (lang === "uz" ? "Manzil aniqlanmoqda…" : "Определение адреса…")
                : locationFailed
                ? (lang === "uz"
                    ? "Joylashuv aniqlanmadi — xaritani suring"
                    : "Не удалось определить местоположение — сдвиньте карту")
                : address || "..."}
            </h3>
            {!loading && !locationFailed && address && (
              <p className="text-[#FF6B00] text-[11px] font-bold uppercase tracking-wider mt-1.5 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#FF6B00]" />
                {address.split(",").pop()?.trim() || (lang === "uz" ? "O'zbekiston" : "Узбекистан")}
              </p>
            )}
            {!loading && locationFailed && (
              <button
                onClick={() => {
                  if (canOpenTelegramLocationSettings()) openTelegramLocationSettings();
                  else locate();
                }}
                className="text-[#FF6B00] text-[13px] font-bold mt-1.5"
              >
                {canOpenTelegramLocationSettings()
                  ? (lang === "uz" ? "Sozlamalarni ochish" : "Открыть настройки")
                  : (lang === "uz" ? "Qayta urinish" : "Повторить")}
              </button>
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
