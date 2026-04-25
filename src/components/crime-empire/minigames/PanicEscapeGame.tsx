"use client";
import { useEffect, useRef } from "react";
import type { GameConfig } from "./gameConfig";

type Props = {
  config: GameConfig;
  onSuccess: (msg: string) => void;
  onFail: (msg: string) => void;
  onFeedback: (msg: string) => void;
};

const PANIC_KEYS = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M",
  "N", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "0",
  "↑", "↓", "←", "→"];

const KEY_MAP: Record<string, string> = {
  ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→",
};

export function PanicEscapeGame({ config, onSuccess, onFail, onFeedback }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cbRef = useRef({ onSuccess, onFail, onFeedback });
  useEffect(() => { cbRef.current = { onSuccess, onFail, onFeedback }; });

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current as HTMLDivElement;

    let finished = false;
    let raf = 0;
    let last = performance.now();

    const SEQ_LEN = config.panicLen;
    const TIME_LIMIT = config.panicTime;
    const MAX_MISTAKES = config.panicMistakes;

    function genSeq(): string[] {
      return Array.from({ length: SEQ_LEN }, () => PANIC_KEYS[Math.floor(Math.random() * PANIC_KEYS.length)]);
    }

    let seq = genSeq();
    let idx = 0;
    let mistakes = 0;
    let timeLeft = TIME_LIMIT;

    function render() {
      const seqHTML = seq.map((k, i) => {
        let cls = "mg-keycap";
        if (i < idx) cls += " done";
        else if (i === idx) cls += " current";
        return `<div class="${cls}" id="mg-key-${i}">${k}</div>`;
      }).join("");

      // Build touch pad (only keys in current seq, deduplicated)
      const padKeys = [...new Set(seq)];
      const padHTML = padKeys.map(k =>
        `<button class="mg-keycap" data-key="${k}" style="border:none">${k}</button>`
      ).join("");

      container.innerHTML = `
        <div class="mg-panic-wrap">
          <div style="color:#8ea0b8;font-size:13px;text-align:center">
            Prime as teclas na ordem certa antes que o tempo acabe!
          </div>
          <div class="mg-panic-seq" id="mg-seq">${seqHTML}</div>
          <div class="mg-readout">
            <div class="mg-metric">
              <b style="color:#8ea0b8;font-size:12px;letter-spacing:.1em;text-transform:uppercase">Tempo</b>
              <div class="mg-bar"><i id="mg-time-bar" style="width:100%"></i></div>
            </div>
            <div class="mg-metric">
              <b style="color:#8ea0b8;font-size:12px;letter-spacing:.1em;text-transform:uppercase">Erros restantes</b>
              <div style="color:#ef4444;font-size:22px;font-weight:900;text-align:center" id="mg-miss-label">${MAX_MISTAKES - mistakes}</div>
            </div>
          </div>
          <div class="mg-panic-pad" id="mg-pad">${padHTML}</div>
        </div>`;
    }

    render();

    function pressKey(k: string) {
      if (finished) return;
      const mapped = KEY_MAP[k] ?? k.toUpperCase();
      const expected = seq[idx];

      if (mapped === expected) {
        const keyEl = container.querySelector(`#mg-key-${idx}`);
        if (keyEl) { keyEl.classList.remove("current"); keyEl.classList.add("done"); }
        idx++;
        if (idx < seq.length) {
          const next = container.querySelector(`#mg-key-${idx}`);
          if (next) next.classList.add("current");
        }
        if (idx >= seq.length) {
          finished = true;
          cbRef.current.onSuccess("Fugiste em pânico! 🏃");
          return;
        }
      } else {
        mistakes++;
        const keyEl = container.querySelector(`#mg-key-${idx}`);
        if (keyEl) {
          keyEl.classList.add("bad");
          setTimeout(() => { keyEl.classList.remove("bad"); keyEl.classList.add("current"); }, 200);
        }
        cbRef.current.onFeedback("❌ Tecla errada!");
        const missEl = container.querySelector("#mg-miss-label");
        if (missEl) missEl.textContent = String(MAX_MISTAKES - mistakes);
        if (mistakes >= MAX_MISTAKES) {
          finished = true;
          cbRef.current.onFail("Demasiados erros! Apanhado!");
          return;
        }
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (finished) return;
      const mapped = KEY_MAP[e.key] ?? e.key.toUpperCase();
      if (PANIC_KEYS.includes(mapped)) {
        e.preventDefault();
        pressKey(e.key);
      }
    };
    window.addEventListener("keydown", onKeyDown);

    const onPadClick = (e: Event) => {
      const btn = (e.target as HTMLElement).closest("[data-key]") as HTMLElement | null;
      if (!btn) return;
      pressKey(btn.dataset.key ?? "");
    };
    container.querySelector("#mg-pad")?.addEventListener("click", onPadClick);

    const timeBar = container.querySelector("#mg-time-bar") as HTMLElement;

    function update(dt: number) {
      if (finished) return;
      timeLeft -= dt;
      const pct = Math.max(0, timeLeft / TIME_LIMIT) * 100;
      if (timeBar) {
        timeBar.style.width = `${pct}%`;
        if (pct < 30) timeBar.parentElement?.classList.add("mg-danger");
      }
      if (timeLeft <= 0) {
        finished = true;
        cbRef.current.onFail("Tempo esgotado! Apanhado!");
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
