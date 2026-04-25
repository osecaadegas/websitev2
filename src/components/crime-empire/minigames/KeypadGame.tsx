"use client";
import { useEffect, useRef } from "react";
import type { GameConfig } from "./gameConfig";

type Props = {
  config: GameConfig;
  onSuccess: (msg: string) => void;
  onFail: (msg: string) => void;
  onFeedback: (msg: string) => void;
};

export function KeypadGame({ config, onSuccess, onFail, onFeedback }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cbRef = useRef({ onSuccess, onFail, onFeedback });
  useEffect(() => { cbRef.current = { onSuccess, onFail, onFeedback }; });

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current as HTMLDivElement;

    let finished = false;
    let raf = 0;
    let last = performance.now();

    const WIN_WIDTH = config.keypadWidth;   // initial window width as fraction
    const SPEED = config.keypadSpeed;       // initial speed (fraction/sec)
    const HITS_NEEDED = config.keypadHits;
    const MAX_MISSES = config.keypadMisses;
    const SHRINK = config.keypadShrink;    // window shrinks per hit

    let pos = Math.random();               // indicator position 0-1
    let vel = SPEED * (Math.random() < 0.5 ? 1 : -1);
    let winLeft = 0.3 + Math.random() * 0.2;
    let winWidth: number = WIN_WIDTH;
    let hits = 0;
    let misses = 0;
    let flashGood = 0;
    let flashBad = 0;

    function buildHTML() {
      const hitDots = Array.from({ length: HITS_NEEDED }, (_, i) =>
        `<i id="mg-hit-${i}" ${i < hits ? 'class="done"' : ""}></i>`).join("");
      return `
        <div class="mg-keypad-wrap">
          <div style="color:#8ea0b8;font-size:13px;text-align:center">
            Prime ESPAÇO / toca no ecrã quando o indicador estiver na janela verde
          </div>
          <div>
            <div class="mg-track mg-keypad-track" id="mg-ktrack">
              <div class="mg-safe-zone-bar" id="mg-kzone" style="left:${winLeft * 100}%;width:${winWidth * 100}%"></div>
              <div class="mg-indicator" id="mg-kind" style="left:${pos * 100}%"></div>
            </div>
            <div class="mg-track-labels"><span>◀</span><span>JANELA</span><span>▶</span></div>
          </div>
          <div class="mg-hit-counter" id="mg-hit-counter">${hitDots}</div>
          <div class="mg-readout">
            <div class="mg-metric">
              <b style="color:#8ea0b8;font-size:12px;letter-spacing:.1em;text-transform:uppercase">Acertos</b>
              <div style="color:#22c55e;font-size:22px;font-weight:900;text-align:center" id="mg-hits-label">${hits}</div>
            </div>
            <div class="mg-metric">
              <b style="color:#8ea0b8;font-size:12px;letter-spacing:.1em;text-transform:uppercase">Erros restantes</b>
              <div style="color:#ef4444;font-size:22px;font-weight:900;text-align:center" id="mg-miss-label">${MAX_MISSES - misses}</div>
            </div>
          </div>
        </div>`;
    }

    container.innerHTML = buildHTML();

    const track = container.querySelector("#mg-ktrack") as HTMLElement;
    const zoneEl = container.querySelector("#mg-kzone") as HTMLElement;
    const indEl = container.querySelector("#mg-kind") as HTMLElement;
    const hitsLabel = container.querySelector("#mg-hits-label") as HTMLElement;
    const missLabel = container.querySelector("#mg-miss-label") as HTMLElement;

    function tryHit() {
      if (finished) return;
      const inWindow = pos >= winLeft && pos <= winLeft + winWidth;
      if (inWindow) {
        hits++;
        flashGood = 0.3;
        cbRef.current.onFeedback("✅ Acerto!");
        // update hit dots
        const dot = container.querySelector(`#mg-hit-${hits - 1}`);
        if (dot) dot.classList.add("done");
        hitsLabel.textContent = String(hits);
        // shrink window
        winWidth = Math.max(0.04, winWidth - SHRINK);
        // slightly shift window position
        winLeft = Math.max(0.02, Math.min(0.98 - winWidth, winLeft + (Math.random() - 0.5) * 0.15));

        if (hits >= HITS_NEEDED) {
          finished = true;
          cbRef.current.onSuccess("Teclado desbloqueado! ⌨️");
          return;
        }
      } else {
        misses++;
        flashBad = 0.25;
        cbRef.current.onFeedback("❌ Errou!");
        missLabel.textContent = String(MAX_MISSES - misses);
        if (misses >= MAX_MISSES) {
          finished = true;
          cbRef.current.onFail("Demasiados erros! Bloqueado!");
          return;
        }
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); tryHit(); }
    };
    window.addEventListener("keydown", onKeyDown);
    track.addEventListener("click", tryHit);
    track.addEventListener("touchstart", (e) => { e.preventDefault(); tryHit(); }, { passive: false });

    function update(dt: number) {
      if (finished) return;

      pos += vel * dt;
      if (pos <= 0) { pos = 0; vel = Math.abs(vel); }
      if (pos >= 1) { pos = 1; vel = -Math.abs(vel); }

      if (flashGood > 0) flashGood -= dt;
      if (flashBad > 0) flashBad -= dt;

      indEl.style.left = `${pos * 100}%`;
      zoneEl.style.left = `${winLeft * 100}%`;
      zoneEl.style.width = `${winWidth * 100}%`;

      if (flashGood > 0) {
        indEl.style.background = "#22c55e";
        indEl.style.boxShadow = "0 0 18px rgba(34,197,94,.9)";
      } else if (flashBad > 0) {
        indEl.style.background = "#ef4444";
        indEl.style.boxShadow = "0 0 18px rgba(239,68,68,.9)";
      } else {
        indEl.style.background = "#e0f2fe";
        indEl.style.boxShadow = "0 0 18px rgba(56,189,248,.8)";
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
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [config]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} className="w-full flex items-center justify-center min-h-[360px]" />;
}
