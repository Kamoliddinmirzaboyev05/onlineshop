import { create } from "zustand";
import { get, post, setToken } from "./api";
import { clearCache } from "./lib/cache";
import { syncPush } from "./push";

interface AuthState {
  username: string | null;
  role: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  loadMe: () => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
}

interface OrderAlertState {
  /** Hali hech bir kuryerga biriktirilmagan, olish mumkin bo'lgan buyurtmalar soni. */
  availableCount: number;
  setAvailableCount: (n: number) => void;
}

/** Layout bitta joyda pollaydi (useOrderAlerts poll), Dashboard shu yerdan o'qib banner chiqaradi. */
export const useOrderAlerts = create<OrderAlertState>((set) => ({
  availableCount: 0,
  setAvailableCount: (n) => set({ availableCount: n }),
}));

export const useAuth = create<AuthState>((set) => ({
  username: null,
  role: null,
  login: async (username, password) => {
    const res = await post<{ access_token: string }>("/admin/auth/login", { username, password });
    setToken(res.access_token);
    try {
      const me = await get<{ username: string; role: string }>("/admin/auth/me");
      if (me.role !== "courier") {
        setToken(null);
        throw new Error("Faqat kuryer hisobi ruxsat etilgan");
      }
      set({ username: me.username, role: me.role });
      syncPush(); // best-effort: re-register push subscription after login
    } catch (err) {
      // /me failed after token was set — roll back to avoid a half-logged-in state.
      setToken(null);
      set({ username: null, role: null });
      throw err;
    }
  },
  logout: () => {
    setToken(null);
    clearCache();
    set({ username: null, role: null });
  },
  loadMe: async () => {
    const me = await get<{ username: string; role: string }>("/admin/auth/me");
    set({ username: me.username, role: me.role });
    syncPush(); // best-effort: re-register on app restart if permission already granted
  },
  changePassword: async (oldPassword, newPassword) => {
    await post("/admin/auth/change-password", {
      old_password: oldPassword,
      new_password: newPassword,
    });
  },
}));
