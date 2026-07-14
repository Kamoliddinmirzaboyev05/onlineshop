import type { Address, Order, Restaurant, RestaurantDetail, User } from "./types";

const BASE = import.meta.env.VITE_API_URL ?? "https://allfoodapi.webportfolio.uz/api";

// Foydalanuvchi do'kon yetkazish hududidan tashqarida — HomePage buni alohida ko'rsatadi.
export class OutOfRangeError extends Error {}

let token: string | null = localStorage.getItem("af_token");

export function setToken(t: string) {
  token = t;
  localStorage.setItem("af_token", t);
}

// Qurilma joylashuvi — sessiya davomida bir marta so'raladi va keshlanadi,
// har sahifada qayta ruxsat so'ralmasligi uchun. Doim yangi qiymat (localStorage'da
// saqlanmaydi) — foydalanuvchi boshqa hududdan buyurtma bersa, eskirgan joylashuv
// bilan noto'g'ri do'kon tanlanmasligi kerak.
let coordsCache: { lat: number; lng: number } | null | undefined;

function getCoords(): Promise<{ lat: number; lng: number } | null> {
  if (coordsCache !== undefined) return Promise.resolve(coordsCache);
  if (!navigator.geolocation) {
    coordsCache = null;
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        coordsCache = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        resolve(coordsCache);
      },
      () => {
        coordsCache = null;
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  });
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

  // faol do'kon — mijoz joylashuviga eng yaqinini tanlaydi, bo'lmasa standart do'kon
  store: async (): Promise<RestaurantDetail | null> => {
    const coords = await getCoords();
    if (coords) {
      try {
        return await req<RestaurantDetail>(`/restaurants/nearest?lat=${coords.lat}&lng=${coords.lng}`);
      } catch (e) {
        // Hech bir do'kon bu hududni yetkazib bermaydi — standartga qaytmasdan xabar beramiz.
        if (e instanceof Error && e.message.includes("OUT_OF_RANGE")) throw new OutOfRangeError();
      }
    }
    try {
      return await req<RestaurantDetail>("/restaurants/default");
    } catch {
      return null;
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
