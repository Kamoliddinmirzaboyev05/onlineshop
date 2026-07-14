// Thin wrapper over the Telegram WebApp SDK with a browser fallback for local dev.

export const tg = window.Telegram?.WebApp;

// initData captured ONCE at startup, before BrowserRouter can rewrite the URL
// and drop the #tgWebAppData fragment. Empty string in plain-browser dev.
let cachedInitData = "";

/**
 * Read the signed launch params from every channel Telegram may use, keeping the
 * first non-empty result. Different launch entry points (menu/attachment button
 * vs a reply-keyboard `web_app` button) don't all populate `tg.initData`, so a
 * single-source read renders the user context empty for some of them.
 */
function readInitData(): string {
  // 1) SDK-provided value — present for most launch types.
  const fromSdk = tg?.initData;
  if (fromSdk) return fromSdk;

  // 2) SDK's own cache of the raw launch params — survives fragment cleanup
  //    and client-side navigation.
  try {
    const cached = sessionStorage.getItem("__telegram__initParams");
    if (cached) {
      const data = JSON.parse(cached)?.tgWebAppData;
      if (data) return data;
    }
  } catch {
    // sessionStorage may be blocked (private mode) — ignore.
  }

  // 3) Raw URL fragment / query — last resort before the router rewrites it.
  const raw = window.location.hash.slice(1) || window.location.search.slice(1);
  return new URLSearchParams(raw).get("tgWebAppData") ?? "";
}

export function initTelegram() {
  // Capture first, synchronously, before anything touches window.location.
  cachedInitData = readInitData();
  if (!tg) return;
  tg.ready();
  tg.expand();
  // Mavzu (light/dark) endi Telegram klientidan emas — store/theme.ts orqali
  // ilovaning o'z holatidan boshqariladi (standart: light).
}

// initData string for backend HMAC auth. Empty in plain browser dev.
// Prefer the value captured at startup; re-read live if init hasn't run yet.
export function getInitData(): string {
  return cachedInitData || readInitData();
}

export function getLanguage(): "uz" | "ru" {
  const code = tg?.initDataUnsafe?.user?.language_code ?? "uz";
  return code.startsWith("ru") ? "ru" : "uz";
}

export function haptic(type: "light" | "medium" | "heavy" = "light") {
  tg?.HapticFeedback?.impactOccurred(type);
}

export const mainButton = tg?.MainButton;
export const backButton = tg?.BackButton;
