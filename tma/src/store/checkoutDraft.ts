import { create } from "zustand";

interface CheckoutDraftState {
  phone: string;
  comment: string;
  loc: { lat: number; lng: number } | null;
  address: string;
  setPhone: (phone: string) => void;
  setComment: (comment: string) => void;
  setLocation: (lat: number, lng: number, address: string) => void;
  reset: () => void;
}

/** Checkout formasi qoralamasi — /checkout/location sahifasiga o'tib
 * qaytganda ham (CheckoutPage qayta unmount bo'lsa ham) yo'qolmasligi uchun
 * global store'da saqlanadi. */
export const useCheckoutDraft = create<CheckoutDraftState>((set) => ({
  phone: "",
  comment: "",
  loc: null,
  address: "",
  setPhone: (phone) => set({ phone }),
  setComment: (comment) => set({ comment }),
  setLocation: (lat, lng, address) => set({ loc: { lat, lng }, address }),
  reset: () => set({ phone: "", comment: "", loc: null, address: "" }),
}));
