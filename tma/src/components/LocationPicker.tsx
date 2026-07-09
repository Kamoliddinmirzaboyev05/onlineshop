import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";

// Default: Farg'ona shahar markazi.
const DEFAULT_CENTER: [number, number] = [40.3864, 71.7864];

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/** Recenters the map when the selected point changes (e.g. from geolocation). */
function Recenter({ point }: { point: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (point) map.setView(point, Math.max(map.getZoom(), 15));
  }, [point, map]);
  return null;
}

interface Props {
  value: { lat: number; lng: number } | null;
  onChange: (lat: number, lng: number) => void;
}

export default function LocationPicker({ value, onChange }: Props) {
  // Birinchi ochilganda — qurilma joylashuvini olishga harakat.
  useEffect(() => {
    if (value || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => onChange(pos.coords.latitude, pos.coords.longitude),
      () => {},
      { enableHighAccuracy: true, timeout: 8000 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const point: [number, number] | null = value ? [value.lat, value.lng] : null;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ height: 240 }}>
      <MapContainer
        center={point ?? DEFAULT_CENTER}
        zoom={point ? 15 : 12}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onPick={onChange} />
        <Recenter point={point} />
        {point && (
          <CircleMarker
            center={point}
            radius={8}
            pathOptions={{ color: "#fff", weight: 2, fillColor: "#FF5722", fillOpacity: 1 }}
          />
        )}
      </MapContainer>
    </div>
  );
}
