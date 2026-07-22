import { useCallback, useEffect, useState } from "react";
import {
  api,
  getLastLocationIssue,
  LocationDeniedError,
  LocationIssue,
  OutOfRangeError,
  retryCoordsIfPreviouslyFailed,
} from "../api/client";
import type { RestaurantDetail } from "../api/types";

/** Faol do'konni joylashuv bo'yicha yuklaydi. Ruxsat berilmasa/qurilmada GPS
 * o'chiq bo'lsa noto'g'ri do'konni jim ko'rsatmaydi — `needsLocation` +
 * `locationIssue` orqali sahifaga aniq holatni bildiradi (xarita ochilmaydi,
 * faqat ruxsat/yoqish so'raladi). */
export function useStore() {
  const [store, setStore] = useState<RestaurantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [outOfRange, setOutOfRange] = useState(false);
  const [needsLocation, setNeedsLocation] = useState(false);
  const [locationIssue, setLocationIssue] = useState<LocationIssue | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    setOutOfRange(false);
    setNeedsLocation(false);
    api
      .store()
      .then((s) => setStore(s))
      .catch((e) => {
        if (e instanceof OutOfRangeError) setOutOfRange(true);
        else if (e instanceof LocationDeniedError) {
          setNeedsLocation(true);
          setLocationIssue(getLastLocationIssue());
        } else setError(true);
      })
      .finally(() => setLoading(false));
  }, []);

  // Keshlangan "muvaffaqiyatsiz" natijani tozalab, qayta urinadi — sahifadagi
  // "Yoqish"/"Ruxsat berish" tugmasi VA qurilma/Telegram sozlamalariga o'tib
  // qaytgandagi avtomatik tekshiruv ikkalasi ham shu orqali ishlaydi.
  const retry = useCallback(() => {
    retryCoordsIfPreviouslyFailed();
    load();
  }, [load]);

  useEffect(() => {
    load();
  }, [load]);

  // Foydalanuvchi joylashuvni yoqish uchun qurilma/Telegram sozlamalariga
  // o'tib qaytganda — qo'lda tugma bosishga majburlamay, avtomatik qayta
  // tekshiramiz.
  useEffect(() => {
    if (!needsLocation) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") retry();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [needsLocation, retry]);

  return { store, loading, error, outOfRange, needsLocation, locationIssue, reload: retry };
}
