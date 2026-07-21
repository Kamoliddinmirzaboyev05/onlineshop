import { useCallback, useEffect, useState } from "react";
import { api, LocationDeniedError, OutOfRangeError, setManualCoords } from "../api/client";
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

  const confirmLocation = useCallback(
    (lat: number, lng: number) => {
      setManualCoords(lat, lng);
      load();
    },
    [load],
  );

  return { store, loading, error, outOfRange, needsLocation, reload: load, confirmLocation };
}
