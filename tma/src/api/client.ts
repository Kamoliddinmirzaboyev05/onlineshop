import type { Address, Order, Restaurant, RestaurantDetail, User } from "./types";

const BASE = import.meta.env.VITE_API_URL ?? "https://allfoodapi.webportfolio.uz/api";

let token: string | null = localStorage.getItem("af_token");

export function setToken(t: string) {
  token = t;
  localStorage.setItem("af_token", t);
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

  // catalog
  restaurants: (q?: string) =>
    req<Restaurant[]>(`/restaurants${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  restaurant: (id: number) => req<RestaurantDetail>(`/restaurants/${id}`),

  // bitta do'kon (single store) — admin default_store bilan bir xil do'kon
  store: async (): Promise<RestaurantDetail | null> => {
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
