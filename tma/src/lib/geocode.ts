/** Koordinatadan o'qiladigan manzilni oladi (OpenStreetMap Nominatim). */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2&accept-language=uz,ru&zoom=18`
    );
    if (!r.ok) return null;
    const d = await r.json();
    if (d?.display_name) return String(d.display_name).split(", ").slice(0, 4).join(", ");
  } catch {
    /* ignore */
  }
  return null;
}
