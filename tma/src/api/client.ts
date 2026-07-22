import { requestTelegramLocation } from "../telegram";
import type { Address, Order, Restaurant, RestaurantDetail, User } from "./types";

const BASE = import.meta.env.VITE_API_URL ?? "https://allfoodapi.webportfolio.uz/api";

// Foydalanuvchi do'kon yetkazish hududidan tashqarida — HomePage buni alohida ko'rsatadi.
export class OutOfRangeError extends Error {}

// Joylashuv aniqlanmadi (ruxsat berilmadi/xato/qo'llab-quvvatlanmaydi) — sahifa
// noto'g'ri (standart) do'konni jim ko'rsatish o'rniga foydalanuvchidan manzilni
// qo'lda tanlashni so'raydi.
export class LocationDeniedError extends Error {}

let token: string | null = localStorage.getItem("af_token");

export function setToken(t: string) {
  token = t;
  localStorage.setItem("af_token", t);
}

// Qurilma joylashuvi — sessiya davomida bir marta so'raladi va keshlanadi,
// har sahifada (va checkoutda ham) qayta ruxsat so'ralmasligi uchun. Doim yangi
// qiymat (localStorage'da saqlanmaydi) — foydalanuvchi boshqa hududdan buyurtma
// bersa, eskirgan joylashuv bilan noto'g'ri do'kon tanlanmasligi kerak.
let coordsCache: { lat: number; lng: number } | null | undefined;
// So'rov havoda turganda (App ochilishi bilan bitta, Home yana bitta chaqirsa)
// ikkinchi marta getCurrentPosition chaqirilmasligi uchun.
let coordsPromise: Promise<{ lat: number; lng: number } | null> | null = null;

// Oxirgi urinish nega muvaffaqiyatsiz bo'lganini UI'ga bildirish uchun —
// "qurilmada GPS o'chiq"/"rad etilgan" holatlarida foydalanuvchiga xaritani
// emas, aynan sozlamalarni yoqish so'ralishi kerak.
export type LocationIssue = "device_off" | "denied" | "other";
let lastLocationIssue: LocationIssue | null = null;
export function getLastLocationIssue(): LocationIssue | null {
  return lastLocationIssue;
}

// TMA ochilishi bilan (App.tsx) va checkout paytida (CheckoutPage) ham shu
// funksiya chaqiriladi — natija keshlangani uchun ikkinchisi darhol qaytadi.
export function getCoords(): Promise<{ lat: number; lng: number } | null> {
  if (coordsCache !== undefined) return Promise.resolve(coordsCache);
  if (coordsPromise) return coordsPromise;
  coordsPromise = requestTelegramLocation()
    .then((result) => {
      if (result.status === "ok") {
        lastLocationIssue = null;
        coordsCache = { lat: result.lat, lng: result.lng };
        return coordsCache;
      }
      if (result.status === "device_off" || result.status === "denied") {
        // Qurilma holati aniq — brauzer Geolocation'ga tushish shart emas,
        // xuddi shu sababdan u ham muvaffaqiyatsiz bo'ladi.
        lastLocationIssue = result.status;
        coordsCache = null;
        return null;
      }
      if (!navigator.geolocation) {
        lastLocationIssue = "other";
        coordsCache = null;
        return null;
      }
      return new Promise<{ lat: number; lng: number } | null>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            lastLocationIssue = null;
            coordsCache = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            resolve(coordsCache);
          },
          () => {
            lastLocationIssue = "other";
            coordsCache = null;
            resolve(null);
          },
          { enableHighAccuracy: true, timeout: 5000 }
        );
      });
    })
    .finally(() => {
      coordsPromise = null;
    });
  return coordsPromise;
}

// Foydalanuvchi joylashuvni yoqib (masalan qurilma sozlamalariga kirib-chiqib)
// ilovaga qaytganda chaqiriladi — faqat OLDINGI urinish MUVAFFAQIYATSIZ (null)
// bo'lgan holatda keshni tozalaydi, shunda keyingi getCoords() qayta so'raydi.
// Muvaffaqiyatli aniqlangan joylashuvni bekorga qayta so'ramaslik uchun
// (coordsCache === undefined — hali umuman so'ralmagan) tegilmaydi.
export function retryCoordsIfPreviouslyFailed() {
  if (coordsCache === null) coordsCache = undefined;
}

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  // auth
  authTelegram: (init_data: string) =>
    req<{ token: { access_token: string }; user: User }>("/auth/telegram", {
      method: "POST",
      body: JSON.stringify({ init_data }),
    }),
  updateMe: (data: Partial<Pick<User, "first_name" | "phone">>) =>
    req<User>("/auth/me", { method: "PATCH", body: JSON.stringify(data) }),

  // catalog
  restaurants: (q?: string) =>
    req<Restaurant[]>(`/restaurants${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  restaurant: (id: number) => req<RestaurantDetail>(`/restaurants/${id}`),

  // faol do'kon — mijoz joylashuviga eng yaqinini tanlaydi. Joylashuv aniqlanmasa
  // (ruxsat berilmagan/xato) standart do'konni taxmin qilmaymiz — LocationDeniedError
  // tashlaymiz, chaqiruvchi sahifa foydalanuvchidan manzilni qo'lda so'raydi.
  store: async (): Promise<RestaurantDetail | null> => {
    const coords = await getCoords();
    if (!coords) throw new LocationDeniedError();
    try {
      return await req<RestaurantDetail>(`/restaurants/nearest?lat=${coords.lat}&lng=${coords.lng}`);
    } catch (e) {
      if (e instanceof Error && e.message.includes("OUT_OF_RANGE")) throw new OutOfRangeError();
      throw e;
    }
  },

  // addresses
  addresses: () => req<Address[]>("/addresses"),
  createAddress: (data: Partial<Address>) =>
    req<Address>("/addresses", { method: "POST", body: JSON.stringify(data) }),
  deleteAddress: (id: number) =>
    req<void>(`/addresses/${id}`, { method: "DELETE" }),

  // orders
  placeOrder: (data: unknown) =>
    req<Order>("/orders", { method: "POST", body: JSON.stringify(data) }),
  myOrders: () => req<Order[]>("/orders"),
  order: (id: number) => req<Order>(`/orders/${id}`),
};
