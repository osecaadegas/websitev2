"use client";
import { useEffect, useRef } from "react";
import type { GameConfig } from "./gameConfig";

type Props = {
  config: GameConfig;
  onSuccess: (msg: string) => void;
  onFail: (msg: string) => void;
  onFeedback: (msg: string) => void;
};

export function SafeCrackGame({ config, onSuccess, onFail, onFeedback }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cbRef = useRef({ onSuccess, onFail, onFeedback });
  useEffect(() => { cbRef.current = { onSuccess, onFail, onFeedback }; });

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current as HTMLDivElement;

    let finished = false;
    let raf = 0;
    let last = performance.now();

    const TOL = config.safeTol;
    const OVER_LIMIT = config.safeOver;
    const WRONG_LIMIT = config.safeWrong;
    const SPEED = config.safeSpeed; // degrees/sec auto spin

    // Generate combination: alternating CW / CCW
    const COMBO_LEN = 3;
    const combo: number[] = Array.from({ length: COMBO_LEN }, () => Math.floor(Math.random() * 100));
    const comboDir: number[] = [1, -1, 1]; // CW, CCW, CW

    let dialAngle = 0;       // visual degrees (360 = one full turn)
    let dialNumber = 0;      // 0-99 logical number
    let currentStep = 0;
    let overturns = 0;       // full rotations on this step
    let wrongPresses = 0;
    let dragging = false;
    let lastMouseAngle = 0;
    let totalRotation = 0;   // accumulated for overturn detection

    function buildHTML() {
      const slots = combo.map((_, i) =>
        `<i id="mg-slot-${i}" ${i < currentStep ? 'class="done"' : ""}></i>`
      ).join("");
      return `
        <div class="mg-safe-wrap">
          <div style="text-align:center;color:#8ea0b8;font-size:13px">
            Roda o disco para cada número da combinação nas direções indicadas
          </div>
          <div style="display:flex;align-items:center;gap:18px;flex-direction:column">
            <div class="mg-dial" id="mg-dial" style="user-select:none">
              <div class="mg-dial-face" id="mg-dial-face"></div>
              <div class="mg-dial-number" id="mg-dial-number">0</div>
            </div>
            <div style="color:#8ea0b8;font-size:12px;text-align:center" id="mg-near-click"></div>
          </div>
          <div class="mg-combo-slots" id="mg-combo-slots">${slots}</div>
          <div style="color:#94a3b8;font-size:14px;font-weight:700;text-align:center" id="mg-step-hint">
            Passo 1: Roda para a <span style="color:#38bdf8">${comboDir[0] > 0 ? "DIREITA" : "ESQUERDA"}</span> até <b style="color:#fff">${combo[0]}</b>
          </div>
          <div style="color:#ef4444;font-size:13px;min-height:20px;text-align:center" id="mg-err"></div>
        </div>`;
    }

    container.innerHTML = buildHTML();

    // Build tick marks
    const dialFace = container.querySelector("#mg-dial-face") as HTMLElement;
    for (let i = 0; i < 100; i++) {
      const mark = document.createElement("div");
      mark.className = "mg-dial-mark" + (i % 10 === 0 ? " major" : "");
      mark.style.transform = `translateX(-50%) rotate(${i * 3.6}deg)`;
      dialFace.appendChild(mark);
    }

    const dialEl = container.querySelector("#mg-dial") as HTMLElement;
    const dialNumEl = container.querySelector("#mg-dial-number") as HTMLElement;
    const nearEl = container.querySelector("#mg-near-click") as HTMLElement;
    const stepHint = container.querySelector("#mg-step-hint") as HTMLElement;
    const errEl = container.querySelector("#mg-err") as HTMLElement;

    function getMouseAngle(e: MouseEvent | Touch) {
      const rect = dialEl.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      return Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI);
    }

    const onMouseDown = (e: MouseEvent) => { dragging = true; lastMouseAngle = getMouseAngle(e); };
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging) return;
      const a = getMouseAngle(e);
      let delta = a - lastMouseAngle;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      lastMouseAngle = a;
      // direction check: comboDir[currentStep] > 0 means CW (positive delta)
      const correctDir = comboDir[currentStep];
      dialAngle += delta;
      totalRotation += delta * correctDir; // positive = correct direction
      dialNumber = ((Math.round(-dialAngle / 3.6) % 100) + 100) % 100;
    };
    const onMouseUp = () => {
      dragging = false;
      checkClick();
    };

    const onTouchStart = (e: TouchEvent) => { dragging = true; lastMouseAngle = getMouseAngle(e.touches[0]); };
    const onTouchMove = (e: TouchEvent) => {
      const a = getMouseAngle(e.touches[0]);
      let delta = a - lastMouseAngle;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      lastMouseAngle = a;
      const correctDir = comboDir[currentStep];
      dialAngle += delta;
      totalRotation += delta * correctDir;
      dialNumber = ((Math.round(-dialAngle / 3.6) % 100) + 100) % 100;
    };
    const onTouchEnd = () => { dragging = false; checkClick(); };

    // Keyboard
    const onKeyDown = (e: KeyboardEvent) => {
      if (finished) return;
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        dialAngle += 3.6;
        totalRotation += 3.6 * comboDir[currentStep];
        dialNumber = ((Math.round(-dialAngle / 3.6) % 100) + 100) % 100;
      }
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        dialAngle -= 3.6;
        totalRotation -= 3.6 * comboDir[currentStep];
        dialNumber = ((Math.round(-dialAngle / 3.6) % 100) + 100) % 100;
      }
      if (e.key === " " || e.key === "Enter") {
        checkClick();
      }
    };

    function checkClick() {
      if (finished) return;
      const target = combo[currentStep];
      const diff = Math.abs(dialNumber - target);
      const isNear = diff <= TOL || diff >= 100 - TOL;

      if (totalRotation < 360 * (currentStep === 0 ? 1 : 0)) {
        // haven't completed enough turns
        wrongPresses++;
        errEl.textContent = "Roda mais!";
        if (wrongPresses >= WRONG_LIMIT) {
          finished = true;
          cbRef.current.onFail("Alarme disparado! Apanhado!");
          return;
        }
        return;
      }

      if (isNear) {
        const slot = container.querySelector(`#mg-slot-${currentStep}`);
        if (slot) slot.className = "done";
        currentStep++;
        totalRotation = 0;
        cbRef.current.onFeedback(`✅ Ponto ${currentStep} desbloqueado!`);

        if (currentStep >= COMBO_LEN) {
          finished = true;
          cbRef.current.onSuccess("Cofre aberto! 💰");
          return;
        }
        const dir = comboDir[currentStep] > 0 ? "DIREITA" : "ESQUERDA";
        stepHint.innerHTML = `Passo ${currentStep + 1}: Roda para a <span style="color:#38bdf8">${dir}</span> até <b style="color:#fff">${combo[currentStep]}</b>`;
        errEl.textContent = "";
      } else {
        wrongPresses++;
        errEl.textContent = "Número errado!";
        cbRef.current.onFeedback("❌ Número errado!");
        if (wrongPresses >= WRONG_LIMIT) {
          finished = true;
          cbRef.current.onFail("Alarme disparado! Apanhado!");
          return;
        }
      }
    }

    dialEl.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    dialEl.addEventListener("touchstart", onTouchStart, { passive: true });
    dialEl.addEventListener("touchmove", onTouchMove, { passive: true });
    dialEl.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("keydown", onKeyDown);

    function update(_dt: number) {
      if (finished) return;
      dialFace.style.transform = `rotate(${dialAngle}deg)`;
      dialNumEl.textContent = String(dialNumber);

      const target = combo[currentStep];
      const diff = Math.min(Math.abs(dialNumber - target), 100 - Math.abs(dialNumber - target));
      if (diff <= TOL * 2) {
        nearEl.textContent = diff <= TOL ? "🟢 Número certo!" : "🟡 Quase...";
      } else {
        nearEl.textContent = "";
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
      dialEl.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      dialEl.removeEventListener("touchstart", onTouchStart);
      dialEl.removeEventListener("touchmove", onTouchMove);
      dialEl.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [config]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} className="w-full flex items-center justify-center min-h-[400px]" />;
}
