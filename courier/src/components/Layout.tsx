import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { get } from "../api";
import { useResource } from "../lib/cache";
import { pageVariants } from "../lib/motion";
import { isAcceptableOrderStatus } from "../lib/orderActions";
import { playOrderAlertSound } from "../push";
import { useOrderAlerts } from "../store";
import type { Order } from "../types";
import BottomNav from "./BottomNav";

const POLL_INTERVAL_MS = 20000;

/** Butun ilova bo'yicha bitta joyda buyurtmalarni pollab, yangi (hali hech
    kimga biriktirilmagan) buyurtma chiqqanda ovoz chalinadi va Dashboard'dagi
    banner uchun hisobni yangilaydi. Layout login sessiyasi davomida faqat bir
    marta mount bo'ladi, shuning uchun "ko'rilgan" id'lar shu yerda saqlanadi. */
function useNewOrderAlerts() {
  const setAvailableCount = useOrderAlerts((s) => s.setAvailableCount);
  const { data } = useResource<Order[]>(
    "courier_orders",
    () => get<Order[]>("/courier/orders"),
    { pollMs: POLL_INTERVAL_MS }
  );
  const seenIds = useRef<Set<number> | null>(null);

  useEffect(() => {
    if (!data) return;
    const available = data.filter((o) => o.assigned_courier_id == null && isAcceptableOrderStatus(o.status));
    setAvailableCount(available.length);

    const ids = new Set(available.map((o) => o.id));
    if (seenIds.current) {
      const isNew = [...ids].some((id) => !seenIds.current!.has(id));
      if (isNew) {
        playOrderAlertSound();
      }
    }
    seenIds.current = ids;
  }, [data, setAvailableCount]);
}

/** Tab sahifalar uchun: kontent + pastki navigatsiya. Tablar almashganda
    sahifa silliq o'tadi (AnimatePresence). */
export default function Layout() {
  const location = useLocation();
  useNewOrderAlerts();
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-md mx-auto pb-20">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </div>
      <BottomNav />
    </div>
  );
}
