import { create } from "zustand";

export type Theme = "light" | "dark";

const KEY = "af_theme";

function apply(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

interface ThemeState {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

// Standart — LIGHT. Telegram klientining o'z mavzusiga bog'liq emas;
// foydalanuvchi Profil sahifasida tanlaydi, tanlovi localStorage'da saqlanadi.
const initial: Theme = (localStorage.getItem(KEY) as Theme | null) ?? "light";
apply(initial);

export const useTheme = create<ThemeState>((set) => ({
  theme: initial,
  setTheme: (t) => {
    localStorage.setItem(KEY, t);
    apply(t);
    set({ theme: t });
  },
}));
