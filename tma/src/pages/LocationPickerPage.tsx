import { useNavigate } from "react-router-dom";
import LocationConfirmSheet from "../components/LocationConfirmSheet";
import { useI18n } from "../i18n";
import { useCheckoutDraft } from "../store/checkoutDraft";
import { haptic } from "../telegram";

/** /checkout/location — mustaqil sahifa sifatida, checkout formasidan alohida
 * navigatsiya qilinadi (o'zining route'i). Manzil global qoralama store'da
 * saqlanadi, shuning uchun bu sahifaga o'tib qaytganda ham checkout formasi
 * (telefon, izoh) yo'qolmaydi. */
export default function LocationPickerPage() {
  const { lang } = useI18n();
  const nav = useNavigate();
  const loc = useCheckoutDraft((s) => s.loc);
  const setLocation = useCheckoutDraft((s) => s.setLocation);

  return (
    <LocationConfirmSheet
      initial={loc}
      lang={lang}
      onClose={() => nav(-1)}
      onConfirm={(lat, lng, address) => {
        setLocation(lat, lng, address);
        haptic("light");
        nav(-1);
      }}
    />
  );
}
