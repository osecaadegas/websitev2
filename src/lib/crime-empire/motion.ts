/**
 * Shared framer-motion variants for the Crime Empire UI.
 * Use to keep tap/press/lift/popIn feedback identical across pages.
 */
import type { Variants } from "framer-motion";

export const tap = { scale: 0.97 } as const;

export const press = {
  whileTap: { scale: 0.96, y: 1 },
  transition: { type: "spring", stiffness: 600, damping: 30 },
} as const;

export const lift = {
  whileHover: { y: -2 },
  transition: { type: "spring", stiffness: 400, damping: 22 },
} as const;

export const popIn: Variants = {
  hidden: { opacity: 0, y: 8, scale: 0.96 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 380, damping: 26 },
  },
};

export const reward: Variants = {
  hidden: { opacity: 0, y: 0, scale: 0.6 },
  show: {
    opacity: 1,
    y: -56,
    scale: 1,
    transition: { duration: 0.95, ease: [0.22, 1, 0.36, 1] },
  },
};
