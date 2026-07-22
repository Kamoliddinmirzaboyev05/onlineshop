import { MapPin } from "lucide-react";
import type { LocationIssue } from "../api/client";
import { useI18n } from "../i18n";
import { openTelegramLocationSettings } from "../telegram";

interface Props {
  issue: LocationIssue | null;
  onRetry: () => void;
}

/** Do'konni joylashuv bo'yicha yuklab bo'lmaganda ko'rsatiladi — hech qachon
 * xarita ochilmaydi, faqat holatga mos ravishda ruxsat so'raladi yoki
 * qurilma/Telegram sozlamalariga yo'naltiriladi. */
export default function LocationNeeded({ issue, onRetry }: Props) {
  const { t } = useI18n();
  const isOff = issue === "device_off" || issue === "denied";

  return (
    <div className="flex flex-col items-center gap-4 py-16 px-4 text-center">
      <MapPin size={32} className="text-tg-hint" />
      <p className="text-tg-hint">{isOff ? t.location_off : t.location_needed}</p>
      <button
        onClick={isOff ? openTelegramLocationSettings : onRetry}
        className="bg-[#121822] text-white font-semibold px-6 py-3 rounded-2xl active:scale-95 transition"
      >
        {isOff ? t.enable_location : t.grant_location}
      </button>
    </div>
  );
}
