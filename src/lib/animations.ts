/* ── Animation constants for consistent, heavy gladiator feel ─────── */

export const TRANSITION_SPRING = {
  type: "spring" as const,
  stiffness: 80,
  damping: 20,
  mass: 1.2,
};

export const TRANSITION_HEAVY = {
  type: "spring" as const,
  stiffness: 60,
  damping: 25,
  mass: 1.8,
};

export const TRANSITION_SMOOTH = {
  duration: 0.6,
  ease: [0.25, 0.46, 0.45, 0.94] as const,
};

export const FADE_UP = {
  initial: { opacity: 0, y: 40 },
  animate: { opacity: 1, y: 0 },
  transition: TRANSITION_SPRING,
};

export const FADE_IN = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.8 },
};

export const SCALE_IN = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  transition: TRANSITION_HEAVY,
};

// Stagger children with arena-rise effect (gladiator entering arena)
export const STAGGER_CONTAINER = {
  animate: {
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.2,
    },
  },
};

export const STAGGER_ITEM = {
  initial: { opacity: 0, y: 60, scale: 0.95 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: TRANSITION_HEAVY,
  },
};

// Page transition variants
export const PAGE_VARIANTS = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.98 },
};

export const PAGE_TRANSITION = {
  duration: 0.5,
  ease: [0.25, 0.46, 0.45, 0.94],
};
