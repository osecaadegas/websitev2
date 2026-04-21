"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import gsap from "gsap";
import { supabase } from "@/lib/supabase";

/**
 * HERO SECTION — Full-screen cinematic entry point.
 *
 * Left-aligned content at the bottom, full-bleed image
 * with GSAP slow-zoom and ambient glow.
 * Hero image and effects come from admin settings (Definições).
 * Uses Supabase Realtime so admin changes appear instantly.
 */

/* ── Hero ────────────────────────────────────────── */
export function HeroSection() {
  const heroRef = useRef<HTMLElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const glowRef = useRef<HTMLDivElement | null>(null);
  const reduceMotion = useReducedMotion();
  const [heroImage, setHeroImage] = useState("/images/arena-gladiator.jpg");
  const [heroFilter, setHeroFilter] = useState("brightness(0.35) saturate(0.7) contrast(0.95)");
  const [heroPosition, setHeroPosition] = useState("50% 50%");
  const homeIdRef = useRef<string | null>(null);

  const applyHome = (home: Record<string, unknown>) => {
    if (home.hero_image) setHeroImage(home.hero_image as string);
    const b = (home.bg_brightness as number) ?? 0.35;
    const s = (home.bg_saturation as number) ?? 0.7;
    const c = (home.bg_contrast as number) ?? 0.95;
    setHeroFilter(`brightness(${b}) saturate(${s}) contrast(${c})`);
    const px = (home.bg_position_x as number) ?? 50;
    const py = (home.bg_position_y as number) ?? 50;
    setHeroPosition(`${px}% ${py}%`);
  };

  /* Fetch + Realtime */
  useEffect(() => {
    fetch("/api/page-settings")
      .then((r) => r.json())
      .then((data) => {
        const home = (data.settings ?? []).find((s: { page_slug: string }) => s.page_slug === "home");
        if (home) {
          homeIdRef.current = home.id;
          applyHome(home);
        }
      })
      .catch(() => {});

    const channel = supabase
      .channel("hero-settings-live")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "page_settings" },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          if (row.page_slug === "home" || row.id === homeIdRef.current) {
            applyHome(row);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (reduceMotion || !heroRef.current || !imageRef.current || !glowRef.current) return;

    const ctx = gsap.context(() => {
      gsap.to(imageRef.current, {
        scale: 1.12,
        duration: 28,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
      });

      gsap.to(glowRef.current, {
        x: 24,
        y: -16,
        opacity: 0.48,
        duration: 14,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
      });
    }, heroRef);

    return () => ctx.revert();
  }, [reduceMotion]);

  return (
    <section ref={heroRef} className="relative min-h-[100svh] overflow-hidden border-b border-white/[0.08]">
      {/* Background image layer */}
      <div className="absolute inset-0">
        <motion.img
          ref={imageRef}
          src={heroImage}
          alt="Gladiator standing in a stormy colosseum"
          className="h-full w-full object-cover"
          style={{ filter: heroFilter, objectPosition: heroPosition }}
          initial={reduceMotion ? false : { scale: 1.03, opacity: 0.84 }}
          animate={reduceMotion ? { opacity: 0.96 } : { opacity: 0.96 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          fetchPriority="high"
          loading="eager"
          decoding="async"
        />

        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_32%,rgba(201,164,76,0.14),transparent_26%),radial-gradient(circle_at_78%_20%,rgba(139,0,0,0.35),transparent_26%),linear-gradient(90deg,rgba(11,11,13,0.94)_0%,rgba(11,11,13,0.72)_34%,rgba(11,11,13,0.22)_62%,rgba(11,11,13,0.9)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,11,13,0.28),rgba(11,11,13,0.66))]" />

        {/* Ambient glow orb */}
        <motion.div
          ref={glowRef}
          className="absolute right-[6%] top-[18%] h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(201,164,76,0.35)_0%,rgba(139,0,0,0.16)_46%,transparent_72%)] blur-0"
          initial={false}
          animate={reduceMotion ? { opacity: 0.24 } : { opacity: [0.18, 0.38, 0.2] }}
          transition={reduceMotion ? undefined : { duration: 12, ease: "easeInOut", repeat: Infinity }}
        />
      </div>

      {/* Content — bottom-left aligned */}
      <div className="relative z-10 flex min-h-[100svh] items-end">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-32 pt-28 sm:pb-36 sm:pt-32 lg:pb-40 lg:pt-36">
          <div className="max-w-3xl">
            {/* Headline */}
            <motion.h1
              className="gladiator-title max-w-2xl text-[clamp(3.2rem,10vw,7.8rem)] leading-[0.92]"
              initial={reduceMotion ? false : { opacity: 0, y: 22 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: "easeOut", delay: 0.25 }}
            >
              SLOTS DRINKS AND WINS
            </motion.h1>

            {/* Subline */}
            <motion.p
              className="mt-5 max-w-xl text-base leading-7 text-white/[0.76] sm:text-lg"
              initial={reduceMotion ? false : { opacity: 0, y: 18 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: "easeOut", delay: 0.4 }}
            >
              The ultimate casino streaming hub for live slots, bonus hunts, giveaways, and big wins.
            </motion.p>


          </div>
        </div>
      </div>
    </section>
  );
}
