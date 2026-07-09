/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: { user?: { id: number; first_name?: string; language_code?: string } };
  colorScheme: "light" | "dark";
  themeParams: Record<string, string>;
  ready(): void;
  expand(): void;
  close(): void;
  MainButton: {
    setText(t: string): void;
    show(): void;
    hide(): void;
    enable(): void;
    disable(): void;
    showProgress(): void;
    hideProgress(): void;
    onClick(cb: () => void): void;
    offClick(cb: () => void): void;
  };
  BackButton: {
    show(): void;
    hide(): void;
    onClick(cb: () => void): void;
    offClick(cb: () => void): void;
  };
  HapticFeedback: { impactOccurred(s: string): void; notificationOccurred(s: string): void };
}

interface Window {
  Telegram?: { WebApp: TelegramWebApp };
}
