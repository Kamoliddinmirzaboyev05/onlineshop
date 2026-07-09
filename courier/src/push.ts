import { get, post } from "./api";

export interface PushPayload {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
}

export const ORDER_ALERT_SOUND_URL = "/order-alert.wav";

type PushHandler = (p: PushPayload) => void;
const pushHandlers = new Set<PushHandler>();
let messageWired = false;

/**
 * Subscribe to push payloads the service worker forwards while the app is open
 * (foreground). The SW suppresses the OS banner when a window is focused and
 * posts the payload here instead, so we can show an in-app toast.
 * Returns an unsubscribe fn.
 */
export function onPushMessage(cb: PushHandler): () => void {
  pushHandlers.add(cb);
  if (!messageWired && "serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (e: MessageEvent) => {
      if (e.data && e.data.type === "push") {
        pushHandlers.forEach((h) => h(e.data.payload as PushPayload));
      }
    });
    messageWired = true;
  }
  return () => pushHandlers.delete(cb);
}

export function playOrderAlertSound(): void {
  if (typeof Audio === "undefined") return;
  const audio = new Audio(ORDER_ALERT_SOUND_URL);
  audio.volume = 1;
  audio.play().catch(() => {
    /* Browser autoplay policy can block sound until the user interacts. */
  });
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function pushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** iOS Safari only exposes PushManager to a Home Screen–installed (standalone) app. */
export function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/** True once launched from the Home Screen icon (not a regular Safari/Chrome tab). */
export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function notifPermission(): NotificationPermission {
  return pushSupported() ? Notification.permission : "denied";
}

async function ensureRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration();
  const reg = existing ?? (await navigator.serviceWorker.register("/sw.js"));
  // ready can hang if the worker never activates — race with a timeout.
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<ServiceWorkerRegistration>((resolve) => setTimeout(() => resolve(reg), 4000)),
  ]);
}

/**
 * Subscribe this courier to web push and register the subscription with the
 * backend (POST /courier/push/subscribe). Returns the resulting permission.
 */
export async function enablePush(): Promise<NotificationPermission> {
  if (!pushSupported()) return "denied";
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return perm;

  const reg = await ensureRegistration();
  const { public_key } = await get<{ public_key: string }>("/courier/push/public-key");
  if (!public_key) throw new Error("Push kaliti olinmadi");

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(public_key).buffer as ArrayBuffer,
    });
  }
  await post("/courier/push/subscribe", sub.toJSON());
  return "granted";
}

/** Best-effort: re-subscribe if already granted (called after login). */
export async function syncPush(): Promise<void> {
  if (!pushSupported() || notifPermission() !== "granted") return;
  try {
    await enablePush();
  } catch {
    /* ignore */
  }
}
