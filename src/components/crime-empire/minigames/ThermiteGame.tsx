"use client";
import { useEffect, useRef } from "react";
import type { GameConfig } from "./gameConfig";

type Props = {
  config: GameConfig;
  onSuccess: (msg: string) => void;
  onFail: (msg: string) => void;
  onFeedback: (msg: string) => void;
};

export function ThermiteGame({ config, onSuccess, onFail, onFeedback }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cbRef = useRef({ onSuccess, onFail, onFeedback });
  useEffect(() => { cbRef.current = { onSuccess, onFail, onFeedback }; });

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current as HTMLDivElement;

    let finished = false;
    let raf = 0;
    let last = performance.now();

    const ZONE = config.thermZone;          // safe zone width as fraction of track
    const GRACE = config.thermGrace;        // seconds of grace when entering zone
    const DURATION = config.thermDuration;  // total game duration
    const SPEED = config.thermSpeed;        // initial speed (fraction/sec)
    const ACCEL = config.thermAccel;        // speed increase per second

    // Random zone position (keep away from edges)
    const zoneLeft = ZONE / 2 + Math.random() * (1 - ZONE * 2);
    const zoneRight = zoneLeft + ZONE;

    // Indicator starts at one side
    let pos = Math.random() < 0.5 ? 0.05 : 0.95;
    let vel = pos < 0.5 ? SPEED : -SPEED;
    let speed = SPEED;
    let timeLeft = DURATION;
    let inZoneTime = 0;
    let graceTime = 0;

    container.innerHTML = `
      <div class="mg-balance-wrap">
        <div style="color:#8ea0b8;font-size:13px;text-align:center">
          Clica/prime ESPAÇO para manter o indicador na zona verde durante ${GRACE.toFixed(1)}s
        </div>
        <div>
          <div class="mg-track" id="mg-track">
            <div class="mg-safe-zone-bar" id="mg-zone" style="left:${zoneLeft * 100}%;width:${ZONE * 100}%"></div>
            <div class="mg-indicator" id="mg-ind" style="left:${pos * 100}%"></div>
          </div>
          <div class="mg-track-labels"><span>◀</span><span>ZONA SEGURA</span><span>▶</span></div>
        </div>
        <div class="mg-readout">
          <div class="mg-metric">
            <b style="color:#8ea0b8;font-size:12px;letter-spacing:.1em;text-transform:uppercase">Tempo</b>
            <div class="mg-bar"><i id="mg-time-bar" style="width:100%"></i></div>
          </div>
          <div class="mg-metric">
            <b style="color:#8ea0b8;font-size:12px;letter-spacing:.1em;text-transform:uppercase">Na Zona</b>
            <div class="mg-bar"><i id="mg-grace-bar" style="width:0%"></i></div>
          </div>
        </div>
        <div style="text-align:center;color:#94a3b8;font-size:13px" id="mg-status">Navega até à zona verde!</div>
      </div>`;

    const track = container.querySelector("#mg-track") as HTMLElement;
    const indEl = container.querySelector("#mg-ind") as HTMLElement;
    const timeBar = container.querySelector("#mg-time-bar") as HTMLElement;
    const graceBar = container.querySelector("#mg-grace-bar") as HTMLElement;
    const statusEl = container.querySelector("#mg-status") as HTMLElement;

    let pressing = false;
    const onPress = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "ArrowLeft" || e.key === "ArrowRight") {
        pressing = true;
        if (e.key === "ArrowLeft") vel = -Math.abs(vel);
        if (e.key === "ArrowRight") vel = Math.abs(vel);
      }
    };
    const onRelease = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "ArrowLeft" || e.key === "ArrowRight") pressing = false;
    };
    const onDown = () => { pressing = true; vel = -vel; };  // tap reverses direction
    const onUp = () => { pressing = false; };

    window.addEventListener("keydown", onPress);
    window.addEventListener("keyup", onRelease);
    track.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    track.addEventListener("touchstart", onDown, { passive: true });
    track.addEventListener("touchend", onUp, { passive: true });

    function update(dt: number) {
      if (finished) return;

      timeLeft -= dt;
      speed += ACCEL * dt;
      vel = vel > 0 ? speed : -speed;

      // When pressing, reverse direction
      if (pressing) vel = -vel;

      pos += vel * dt;
      if (pos <= 0) { pos = 0; vel = Math.abs(vel); }
      if (pos >= 1) { pos = 1; vel = -Math.abs(vel); }

      const inZone = pos >= zoneLeft && pos <= zoneRight;
      if (inZone) {
        inZoneTime += dt;
        graceTime += dt;
        statusEl.textContent = "✅ Na zona! Mantém!";
        statusEl.style.color = "#22c55e";
      } else {
        graceTime = 0;
        statusEl.textContent = "Navega até à zona verde!";
        statusEl.style.color = "#94a3b8";
      }

      indEl.style.left = `${pos * 100}%`;
      const timePct = Math.max(0, timeLeft / DURATION) * 100;
      timeBar.style.width = `${timePct}%`;
      if (timePct < 30) timeBar.parentElement?.classList.add("mg-danger");

      graceBar.style.width = `${Math.min(100, (graceTime / GRACE) * 100)}%`;

      if (graceTime >= GRACE) {
        finished = true;
        cbRef.current.onSuccess("Termite detonada! 🔥");
        return;
      }

      if (timeLeft <= 0) {
        finished = true;
        cbRef.current.onFail("Tempo esgotado! Falhou!");
        return;
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
      window.removeEventListener("keydown", onPress);
      window.removeEventListener("keyup", onRelease);
      track.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
    };
  }, [config]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} className="w-full flex items-center justify-center min-h-[360px]" />;
}
