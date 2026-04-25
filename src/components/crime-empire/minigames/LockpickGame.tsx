"use client";
import { useEffect, useRef } from "react";
import type { GameConfig } from "./gameConfig";

type Props = {
  config: GameConfig;
  onSuccess: (msg: string) => void;
  onFail: (msg: string) => void;
  onFeedback: (msg: string) => void;
};

export function LockpickGame({ config, onSuccess, onFail, onFeedback }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cbRef = useRef({ onSuccess, onFail, onFeedback });
  useEffect(() => { cbRef.current = { onSuccess, onFail, onFeedback }; });

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current as HTMLDivElement;

    let finished = false;
    let raf = 0;
    let last = performance.now();

    // state
    let pickAngle = 0;          // degrees — mouse/keyboard controlled
    let tensionAngle = 0;       // current tension wrench angle
    let tensionTarget = 0;
    let brokePicks = 0;
    let setCount = 0;
    let jiggle = 0;

    const TOL = config.lockTol;
    const OPEN_PCT = config.lockOpen / 100;
    const BREAK_PICKS = config.lockBreak;
    const SECRET = Math.random() * 160 - 80;  // sweet spot angle

    container.innerHTML = `
      <div class="mg-lock-wrap">
        <div class="mg-readout">
          <div class="mg-metric">
            <b style="color:#8ea0b8;font-size:12px;letter-spacing:.1em;text-transform:uppercase">Picks</b>
            <div id="mg-picks-bar" class="mg-bar"><i style="width:${(brokePicks / BREAK_PICKS) * 100}%"></i></div>
          </div>
          <div class="mg-metric">
            <b style="color:#8ea0b8;font-size:12px;letter-spacing:.1em;text-transform:uppercase">Tensão</b>
            <div id="mg-tension-bar" class="mg-bar"><i style="width:0%"></i></div>
          </div>
        </div>
        <div class="mg-lock-stage" id="mg-stage">
          <div class="mg-lock-body">
            <div class="mg-lock-cylinder" id="mg-cylinder"></div>
          </div>
          <div class="mg-pick" id="mg-pick" style="transform:translateX(-50%) rotate(0deg)"></div>
          <div class="mg-tension-arm" id="mg-tension" style="transform:translateY(-50%) rotate(0deg)"></div>
        </div>
        <div style="color:#8ea0b8;font-size:13px;text-align:center;max-width:360px">
          Move o rato para rodar o pick. Clica e segura para aplicar tensão quando estiver no ponto certo.
        </div>
      </div>`;

    const stage = container.querySelector("#mg-stage") as HTMLElement;
    const pickEl = container.querySelector("#mg-pick") as HTMLElement;
    const tensionEl = container.querySelector("#mg-tension") as HTMLElement;
    const cylinderEl = container.querySelector("#mg-cylinder") as HTMLElement;
    const picksBar = container.querySelector("#mg-picks-bar > i") as HTMLElement;
    const tensionBar = container.querySelector("#mg-tension-bar > i") as HTMLElement;

    let pressing = false;
    let mouseX = 0;
    let mouseY = 0;

    const onMouseMove = (e: MouseEvent) => {
      const rect = stage.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      mouseX = e.clientX - cx;
      mouseY = e.clientY - cy;
    };
    const onMouseDown = () => { pressing = true; };
    const onMouseUp = () => { pressing = false; };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") pickAngle -= 3;
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") pickAngle += 3;
      if (e.key === " " || e.key === "ArrowUp") pressing = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "ArrowUp") pressing = false;
    };
    const onTouchMove = (e: TouchEvent) => {
      const rect = stage.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      mouseX = e.touches[0].clientX - cx;
      mouseY = e.touches[0].clientY - cy;
    };
    const onTouchStart = () => { pressing = true; };
    const onTouchEnd = () => { pressing = false; };

    stage.addEventListener("mousemove", onMouseMove);
    stage.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    stage.addEventListener("touchmove", onTouchMove, { passive: true });
    stage.addEventListener("touchstart", onTouchStart, { passive: true });
    stage.addEventListener("touchend", onTouchEnd, { passive: true });

    function update(dt: number) {
      if (finished) return;

      // Update pick angle from mouse
      if (mouseX !== 0 || mouseY !== 0) {
        pickAngle = Math.atan2(mouseX, -mouseY) * (180 / Math.PI);
      }
      pickAngle = Math.max(-80, Math.min(80, pickAngle));

      const nearSweet = Math.abs(pickAngle - SECRET) < TOL;

      // Tension
      if (pressing) {
        tensionTarget = nearSweet ? OPEN_PCT : 0;
        if (!nearSweet) {
          jiggle += dt;
          if (jiggle > 0.4) {
            jiggle = 0;
            brokePicks++;
            cbRef.current.onFeedback("❌ Pick partido!");
            if (brokePicks >= BREAK_PICKS) {
              finished = true;
              cbRef.current.onFail("Sem picks! Apanhado!");
              return;
            }
          }
        } else {
          jiggle = 0;
        }
      } else {
        tensionTarget = 0;
        jiggle = 0;
      }

      tensionAngle += (tensionTarget * 45 - tensionAngle) * Math.min(1, dt * 8);

      if (setCount === 0 && tensionAngle > 44) {
        setCount = 1;
      }

      // Open condition: tension held at sweet spot for enough time
      if (nearSweet && pressing) {
        setCount += dt;
      }
      if (setCount > 1.5) {
        finished = true;
        cbRef.current.onSuccess("Fechadura aberta! 🔓");
        return;
      }

      // Cylinder wobble from jiggle
      const wobble = pressing && !nearSweet ? Math.sin(Date.now() * 0.05) * 4 : 0;

      pickEl.style.transform = `translateX(-50%) rotate(${pickAngle}deg)`;
      tensionEl.style.transform = `translateY(-50%) rotate(${tensionAngle + wobble}deg)`;
      const tensionPct = (tensionAngle / 45) * 100;
      tensionBar.style.width = `${tensionPct}%`;
      picksBar.style.width = `${(brokePicks / BREAK_PICKS) * 100}%`;
      if (brokePicks / BREAK_PICKS > 0.6) picksBar.parentElement?.classList.add("mg-danger");

      // Cylinder glow when near sweet spot
      if (nearSweet && pressing) {
        cylinderEl.style.filter = "brightness(1.6) drop-shadow(0 0 12px rgba(56,189,248,.9))";
      } else {
        cylinderEl.style.filter = "";
      }
    }

    function loop(now: number) {
      if (finished) return;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      update(dt);
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    return () => {
      finished = true;
      cancelAnimationFrame(raf);
      stage.removeEventListener("mousemove", onMouseMove);
      stage.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      stage.removeEventListener("touchmove", onTouchMove);
      stage.removeEventListener("touchstart", onTouchStart);
      stage.removeEventListener("touchend", onTouchEnd);
    };
  }, [config]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} className="w-full flex items-center justify-center min-h-[400px]" />;
}
