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

// ── Modul-darajadagi kesh ──────────────────────────────────────────
// Home/Category/Search har biri useStore chaqiradi. Avval har mount'da
// to'liq katalog qayta yuklanardi → sekinlik + rasm qayta so'rovlari.
// Endi sessiya davomida bitta so'rov; sahifa o'tganda darhol kesh.

type Snapshot = {
  store: RestaurantDetail | null;
  error: boolean;
  outOfRange: boolean;
  needsLocation: boolean;
  locationIssue: LocationIssue | null;
};

let cache: Snapshot | null = null;
let inflight: Promise<Snapshot> | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

async function fetchStore(force = false): Promise<Snapshot> {
  if (!force && cache && !cache.error && !cache.needsLocation && !cache.outOfRange) {
    return cache;
  }
  if (!force && inflight) return inflight;

  inflight = (async () => {
    const next: Snapshot = {
      store: null,
      error: false,
      outOfRange: false,
      needsLocation: false,
      locationIssue: null,
    };
    try {
      next.store = await api.store();
    } catch (e) {
      if (e instanceof OutOfRangeError) next.outOfRange = true;
      else if (e instanceof LocationDeniedError) {
        next.needsLocation = true;
        next.locationIssue = getLastLocationIssue();
      } else next.error = true;
    }
    cache = next;
    inflight = null;
    notify();
    return next;
  })();

  return inflight;
}

/** Faol do'konni joylashuv bo'yicha yuklaydi. Ruxsat berilmasa/qurilmada GPS
 * o'chiq bo'lsa noto'g'ri do'konni jim ko'rsatmaydi — `needsLocation` +
 * `locationIssue` orqali sahifaga aniq holatni bildiradi (xarita ochilmaydi,
 * faqat ruxsat/yoqish so'raladi). */
export function useStore() {
  const [snap, setSnap] = useState<Snapshot>(
    () =>
      cache ?? {
        store: null,
        error: false,
        outOfRange: false,
        needsLocation: false,
        locationIssue: null,
      },
  );
  const [loading, setLoading] = useState(!cache || !!inflight);

  useEffect(() => {
    const onChange = () => {
      if (cache) {
        setSnap(cache);
        setLoading(false);
      }
    };
    listeners.add(onChange);

    if (cache && !cache.error && !cache.needsLocation && !cache.outOfRange) {
      setSnap(cache);
      setLoading(false);
    } else {
      setLoading(true);
      fetchStore().then((s) => {
        setSnap(s);
        setLoading(false);
      });
    }

    return () => {
      listeners.delete(onChange);
    };
  }, []);

  // Keshlangan "muvaffaqiyatsiz" natijani tozalab, qayta urinadi — sahifadagi
  // "Yoqish"/"Ruxsat berish" tugmasi VA qurilma/Telegram sozlamalariga o'tib
  // qaytgandagi avtomatik tekshiruv ikkalasi ham shu orqali ishlaydi.
  const retry = useCallback(() => {
    retryCoordsIfPreviouslyFailed();
    cache = null;
    setLoading(true);
    fetchStore(true).then((s) => {
      setSnap(s);
      setLoading(false);
    });
  }, []);

  // Foydalanuvchi joylashuvni yoqish uchun qurilma/Telegram sozlamalariga
  // o'tib qaytganda — qo'lda tugma bosishga majburlamay, avtomatik qayta
  // tekshiramiz.
  useEffect(() => {
    if (!snap.needsLocation) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") retry();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [snap.needsLocation, retry]);

  return {
    store: snap.store,
    loading,
    error: snap.error,
    outOfRange: snap.outOfRange,
    needsLocation: snap.needsLocation,
    locationIssue: snap.locationIssue,
    reload: retry,
  };
}

/** App ochilishi bilan oldindan yuklash (Home skeleton qisqaroq). */
export function prefetchStore() {
  void fetchStore();
}
