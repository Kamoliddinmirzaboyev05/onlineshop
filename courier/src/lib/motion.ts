import type { Transition, Variants } from "motion/react";

/** Soft spring used for tap/press and shared-layout transitions. */
export const spring: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 32,
  mass: 0.7,
};

/** Page enter/exit — subtle vertical slide + fade. */
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.18, ease: "easeIn" } },
};

/** Stagger container for lists. */
export const listContainer: Variants = {
  animate: {
    transition: { staggerChildren: 0.05, delayChildren: 0.02 },
  },
};

/** Each list item rises into place. */
export const listItem: Variants = {
  initial: { opacity: 0, y: 14, scale: 0.98 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] },
  },
  exit: { opacity: 0, scale: 0.97, transition: { duration: 0.15 } },
};

/** Tap feedback for pressable cards/buttons. */
export const tap = { scale: 0.97 } as const;
