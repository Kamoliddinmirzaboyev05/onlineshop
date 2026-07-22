import { useCallback, useEffect, useState } from "react";
import { api, LocationDeniedError, OutOfRangeError, retryCoordsIfPreviouslyFailed, setManualCoords } from "../api/client";
import type { RestaurantDetail } from "../api/types";

/** Faol do'konni joylashuv bo'yicha yuklaydi. Ruxsat berilmasa noto'g'ri
 * do'konni jim ko'rsatmaydi — `needsLocation` orqali qo'lda tanlashni so'raydi. */
export function useStore() {
  const [store, setStore] = useState<RestaurantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [outOfRange, setOutOfRange] = useState(false);
  const [needsLocation, setNeedsLocation] = useState(false);

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
        else if (e instanceof LocationDeniedError) setNeedsLocation(true);
        else setError(true);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Foydalanuvchi joylashuvni yoqish uchun qurilma/Telegram sozlamalariga
  // o'tib qaytganda — qo'lda "qayta urinish" tugmasini bosishga majburlamay,
  // avtomatik qayta tekshiramiz.
  useEffect(() => {
    if (!needsLocation) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        retryCoordsIfPreviouslyFailed();
        load();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [needsLocation, load]);

  const confirmLocation = useCallback(
    (lat: number, lng: number) => {
      setManualCoords(lat, lng);
      load();
    },
    [load],
  );

  return { store, loading, error, outOfRange, needsLocation, reload: load, confirmLocation };
}
