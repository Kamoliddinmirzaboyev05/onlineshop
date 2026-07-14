import { create } from "zustand";
import { api, setToken } from "../api/client";
import type { User } from "../api/types";
import { getInitData } from "../telegram";

interface AuthState {
  user: User | null;
  ready: boolean;
  error: string | null;
  login: () => Promise<void>;
  setUser: (u: User) => void;
}

// Guards against StrictMode's double-invoked effect firing two concurrent auth POSTs.
let authInFlight = false;

export const useAuth = create<AuthState>((set) => ({
  user: null,
  ready: false,
  error: null,
  login: async () => {
    if (authInFlight) return;
    const initData = getInitData();
    if (!initData) {
      // browser dev fallback: no Telegram context
      set({ ready: true, error: "Telegram konteksti topilmadi (brauzer rejimi)" });
      return;
    }
    authInFlight = true;
    try {
      const res = await api.authTelegram(initData);
      setToken(res.token.access_token);
      set({ user: res.user, ready: true, error: null });
    } catch (e) {
      set({ ready: true, error: String(e) });
    } finally {
      authInFlight = false;
    }
  },
  setUser: (u) => set({ user: u }),
}));
