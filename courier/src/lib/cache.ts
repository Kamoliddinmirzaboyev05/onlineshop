import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Lightweight stale-while-revalidate cache + hook.
 *
 * - Memory layer: instant, survives in-session navigation.
 * - localStorage layer: survives reloads / cold starts so a returning courier
 *   sees data immediately (no skeleton) while a fresh copy loads in background.
 *
 * A page shows the skeleton ONLY on a true cold load (no cached value at all).
 * On error we keep the last good value and surface the error separately, so a
 * flaky network never blanks the screen.
 */

const PREFIX = "af_cache_";
const VERSION = 1;

interface Entry<T> {
  v: number;
  t: number; // saved-at epoch ms
  data: T;
}

const memory = new Map<string, Entry<unknown>>();
// Per-key subscribers so multiple mounted components on the same key stay in sync.
const listeners = new Map<string, Set<() => void>>();

function readPersisted<T>(key: string): Entry<T> | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Entry<T>;
    if (parsed.v !== VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

function readEntry<T>(key: string): Entry<T> | null {
  const mem = memory.get(key) as Entry<T> | undefined;
  if (mem) return mem;
  const persisted = readPersisted<T>(key);
  if (persisted) memory.set(key, persisted);
  return persisted;
}

function writeEntry<T>(key: string, data: T) {
  const entry: Entry<T> = { v: VERSION, t: Date.now(), data };
  memory.set(key, entry);
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {
    /* storage full / private mode — memory cache still works */
  }
  listeners.get(key)?.forEach((fn) => fn());
}

/** Drop everything (called on logout so the next courier starts clean). */
export function clearCache() {
  memory.clear();
  try {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith(PREFIX)) localStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}

export interface Resource<T> {
  data: T | null;
  /** Cold load — no cached value yet. Drives the skeleton. */
  loading: boolean;
  /** Background revalidation while showing cached data. */
  refreshing: boolean;
  error: string | null;
  /** Manual reload (pull-to-refresh / header button). */
  refresh: () => void;
}

interface Options {
  /** Background poll interval (ms). Paused while the tab is hidden. */
  pollMs?: number;
  /** Revalidate when the window regains focus. Default true. */
  revalidateOnFocus?: boolean;
  /** Skip fetching entirely (e.g. dependency not ready). */
  enabled?: boolean;
  /** User-facing error text on failure. */
  errorText?: string;
}

export function useResource<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  options: Options = {}
): Resource<T> {
  const {
    pollMs,
    revalidateOnFocus = true,
    enabled = true,
    errorText = "Yuklab bo'lmadi. Internetni tekshiring.",
  } = options;

  const cached = key ? readEntry<T>(key) : null;
  const [data, setData] = useState<T | null>(cached?.data ?? null);
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep the latest fetcher/key without retriggering the effect on every render.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const reqId = useRef(0);

  const load = useCallback(
    async (silent: boolean) => {
      if (!key || !enabled) return;
      const myId = ++reqId.current;
      const hadData = readEntry<T>(key) != null;
      if (silent || hadData) setRefreshing(true);
      else setLoading(true);
      try {
        const fresh = await fetcherRef.current();
        if (myId !== reqId.current) return; // a newer load won
        writeEntry(key, fresh);
        setData(fresh);
        setError(null);
      } catch {
        if (myId !== reqId.current) return;
        // Keep stale data; only surface the error.
        setError(errorText);
      } finally {
        if (myId === reqId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [key, enabled, errorText]
  );

  // Initial load + subscribe to cross-component cache writes for this key.
  useEffect(() => {
    if (!key || !enabled) return;
    const entry = readEntry<T>(key);
    if (entry) {
      setData(entry.data);
      setLoading(false);
    } else {
      setLoading(true);
    }
    load(false);

    const onChange = () => {
      const e = readEntry<T>(key);
      if (e) setData(e.data);
    };
    let set = listeners.get(key);
    if (!set) {
      set = new Set();
      listeners.set(key, set);
    }
    set.add(onChange);
    return () => {
      set!.delete(onChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  // Background polling (visible tab only).
  useEffect(() => {
    if (!pollMs || !key || !enabled) return;
    const iv = setInterval(() => {
      if (document.visibilityState === "visible") load(true);
    }, pollMs);
    return () => clearInterval(iv);
  }, [pollMs, key, enabled, load]);

  // Revalidate on focus / tab re-show.
  useEffect(() => {
    if (!revalidateOnFocus || !key || !enabled) return;
    const onFocus = () => {
      if (document.visibilityState === "visible") load(true);
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [revalidateOnFocus, key, enabled, load]);

  const refresh = useCallback(() => load(true), [load]);

  return { data, loading, refreshing, error, refresh };
}
