import { motion } from "motion/react";
import { pageVariants } from "../lib/motion";

/** Wraps a route's content so it slides/fades on enter & exit. */
export default function AnimatedPage({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {children}
    </motion.div>
  );
}
