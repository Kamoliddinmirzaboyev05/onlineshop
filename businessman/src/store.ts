import { create } from "zustand";
import { get, post, setToken } from "./api";
import type { Business } from "./types";

interface AuthState {
  business: Business | null;
  login: (username: string, password: string) => Promise<void>;
  loadMe: () => Promise<void>;
  logout: () => void;
  changePassword: (oldPassword: string, newPassword: string, newUsername?: string) => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  business: null,
  login: async (username, password) => {
    const res = await post<{ access_token: string }>("/business/auth/login", { username, password });
    setToken(res.access_token);
    try {
      const me = await get<Business>("/business/auth/me");
      set({ business: me });
    } catch (e) {
      // /me failed after token was set — roll back so we don't end up half-authed
      setToken(null);
      set({ business: null });
      throw e;
    }
  },
  loadMe: async () => {
    try {
      const me = await get<Business>("/business/auth/me");
      set({ business: me });
    } catch {
      set({ business: null });
    }
  },
  logout: () => {
    setToken(null);
    set({ business: null });
  },
  changePassword: async (oldPassword, newPassword, newUsername) => {
    await post("/business/auth/change-password", {
      old_password: oldPassword,
      new_password: newPassword,
      new_username: newUsername,
    });
  },
}));

// Tanlangan do'kon — barcha per-do'kon so'rovlari shu id bilan ketadi.
// localStorage'da saqlanadi (`af_business_store`), sahifa yangilansa qoladi.
interface StoreState {
  selectedStoreId: number | null;
  setSelectedStore: (id: number) => void;
}

const STORE_KEY = "af_business_store";
const saved = localStorage.getItem(STORE_KEY);

export const useStore = create<StoreState>((set) => ({
  selectedStoreId: saved ? Number(saved) : null,
  setSelectedStore: (id) => {
    localStorage.setItem(STORE_KEY, String(id));
    set({ selectedStoreId: id });
  },
}));
