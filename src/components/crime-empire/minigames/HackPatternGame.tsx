"use client";
import { useEffect, useRef } from "react";
import type { GameConfig } from "./gameConfig";

type Props = {
  config: GameConfig;
  onSuccess: (msg: string) => void;
  onFail: (msg: string) => void;
  onFeedback: (msg: string) => void;
};

export function HackPatternGame({ config, onSuccess, onFail, onFeedback }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cbRef = useRef({ onSuccess, onFail, onFeedback });
  useEffect(() => { cbRef.current = { onSuccess, onFail, onFeedback }; });

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current as HTMLDivElement;

    let finished = false;
    let raf = 0;
    let last = performance.now();

    const GRID = config.hackGrid;          // 3 or 4
    const START_SEQ = config.hackStart;    // initial pattern length
    const ROUNDS = config.hackRounds;
    const STEP = config.hackStep;          // each cell lit for this many seconds

    const totalCells = GRID * GRID;
    type Phase = "show" | "input";
    let phase: Phase = "show";
    let currentRound = 0;
    let pattern: number[] = [];
    let showIdx = 0;
    let showTimer = 0;
    let inputIdx = 0;
    let badCell = -1;
    let badTimer = 0;

    function genPattern(len: number): number[] {
      const arr: number[] = [];
      while (arr.length < len) {
        const n = Math.floor(Math.random() * totalCells);
        if (!arr.includes(n)) arr.push(n);
      }
      return arr;
    }

    function buildGrid() {
      container.innerHTML = `
        <div class="mg-hack-wrap">
          <div style="color:#8ea0b8;font-size:13px;text-align:center">
            Memoriza e repete a sequência de células que acende
          </div>
          <div class="mg-hack-grid" id="mg-grid" style="grid-template-columns:repeat(${GRID},1fr)">
            ${Array.from({ length: totalCells }, (_, i) => `<button class="mg-cell" id="mg-cell-${i}" style="border:none;font-size:${GRID === 4 ? "14px" : "18px"}">${i + 1}</button>`).join("")}
          </div>
          <div style="color:#94a3b8;font-size:14px;font-weight:700;text-align:center;min-height:24px" id="mg-phase-label">Memoriza...</div>
          <div class="mg-readout">
            <div class="mg-metric">
              <b style="color:#8ea0b8;font-size:12px;letter-spacing:.1em;text-transform:uppercase">Ronda</b>
              <div style="color:#e5edf9;font-size:20px;font-weight:900;text-align:center">${currentRound + 1} / ${ROUNDS}</div>
            </div>
            <div class="mg-metric">
              <b style="color:#8ea0b8;font-size:12px;letter-spacing:.1em;text-transform:uppercase">Sequência</b>
              <div style="color:#e5edf9;font-size:20px;font-weight:900;text-align:center" id="mg-seq-label">${inputIdx} / ${pattern.length}</div>
            </div>
          </div>
        </div>`;
    }

    function startRound() {
      pattern = genPattern(START_SEQ + currentRound);
      phase = "show";
      showIdx = 0;
      showTimer = 0;
      inputIdx = 0;
      const label = container.querySelector("#mg-phase-label");
      if (label) label.textContent = "Memoriza...";
      clearAllCells();
    }

    function clearAllCells() {
      for (let i = 0; i < totalCells; i++) {
        const c = container.querySelector(`#mg-cell-${i}`);
        if (c) c.className = "mg-cell";
      }
    }

    buildGrid();
    startRound();

    // Click handler for input phase
    const onGridClick = (e: Event) => {
      if (phase !== "input" || finished) return;
      const btn = (e.target as HTMLElement).closest(".mg-cell") as HTMLElement | null;
      if (!btn) return;
      const idx = parseInt(btn.id.replace("mg-cell-", ""));
      if (isNaN(idx)) return;

      const expected = pattern[inputIdx];
      if (idx === expected) {
        btn.classList.add("hit");
        inputIdx++;
        const seqEl = container.querySelector("#mg-seq-label");
        if (seqEl) seqEl.textContent = `${inputIdx} / ${pattern.length}`;

        if (inputIdx >= pattern.length) {
          currentRound++;
          cbRef.current.onFeedback(`✅ Ronda ${currentRound} completa!`);
          if (currentRound >= ROUNDS) {
            finished = true;
            cbRef.current.onSuccess("Sistema hackeado! 💻");
            return;
          }
          // brief pause then next round
          setTimeout(() => {
            clearAllCells();
            startRound();
            const label = container.querySelector("#mg-phase-label");
            if (label) label.textContent = "Memoriza...";
            const rdEl = container.querySelector(".mg-metric div");
            if (rdEl) rdEl.textContent = `${currentRound + 1} / ${ROUNDS}`;
          }, 600);
        }
      } else {
        btn.classList.add("bad");
        badCell = idx;
        badTimer = 0.5;
        finished = true;
        cbRef.current.onFail("Sequência errada! Alerta de segurança!");
      }
    };

    container.querySelector("#mg-grid")?.addEventListener("click", onGridClick);

    function update(dt: number) {
      if (finished) return;

      if (phase === "show") {
        showTimer -= dt;
        if (showTimer <= 0) {
          // Light up cell
          clearAllCells();
          if (showIdx < pattern.length) {
            const c = container.querySelector(`#mg-cell-${pattern[showIdx]}`);
            if (c) c.classList.add("lit");
            showIdx++;
            showTimer = STEP;
          } else {
            // Done showing — switch to input
            clearAllCells();
            phase = "input";
            const label = container.querySelector("#mg-phase-label");
            if (label) label.textContent = "A tua vez! Repete a sequência.";
          }
        }
      }

      if (badTimer > 0) {
        badTimer -= dt;
        if (badTimer <= 0 && badCell >= 0) {
          const c = container.querySelector(`#mg-cell-${badCell}`);
          if (c) c.classList.remove("bad");
          badCell = -1;
        }
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
    };
  }, [config]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} className="w-full flex items-center justify-center min-h-[400px]" />;
}
