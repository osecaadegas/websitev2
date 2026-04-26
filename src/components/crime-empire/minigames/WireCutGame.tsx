"use client";
import { useEffect, useRef } from "react";
import type { GameConfig } from "./gameConfig";

type Props = {
  config: GameConfig;
  onSuccess: (msg: string) => void;
  onFail: (msg: string) => void;
  onFeedback: (msg: string) => void;
};

const WIRE_COLORS = ["red", "blue", "yellow", "green", "black", "white", "purple", "orange"] as const;
const COLOR_NAMES: Record<string, string> = {
  red: "VERMELHO", blue: "AZUL", yellow: "AMARELO", green: "VERDE",
  black: "PRETO", white: "BRANCO", purple: "ROXO", orange: "LARANJA",
};
const COLOR_BG: Record<string, string> = {
  red: "#ef4444", blue: "#3b82f6", yellow: "#eab308", green: "#22c55e",
  black: "#374151", white: "#d1d5db", purple: "#a855f7", orange: "#f97316",
};

// Wire cut rules
const RULES = [
  { text: "Corta o fio com mais fios da mesma cor", check: (wires: string[], cut: string) => wires.filter(w => w === cut).length >= 2 },
  { text: "Corta o fio VERMELHO (ou azul se não houver)", check: (wires: string[], cut: string) => wires.includes("red") ? cut === "red" : cut === "blue" },
  { text: "Não cortes o fio PRETO", check: (_wires: string[], cut: string) => cut !== "black" },
  { text: "Corta o último fio da lista", check: (wires: string[], cut: string) => cut === wires[wires.length - 1] },
  { text: "Corta o fio mais RARO (única cor)", check: (wires: string[], cut: string) => { const counts: Record<string, number> = {}; wires.forEach(w => counts[w] = (counts[w] || 0) + 1); const rare = wires.find(w => counts[w] === 1); return cut === (rare ?? wires[0]); } },
];

export function WireCutGame({ config, onSuccess, onFail, onFeedback }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cbRef = useRef({ onSuccess, onFail, onFeedback });
  useEffect(() => { cbRef.current = { onSuccess, onFail, onFeedback }; });

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current as HTMLDivElement;

    let finished = false;
    let raf = 0;
    let last = performance.now();
    let timeLeft = config.wireTime;
    let cutCount = 0;

    const count = config.wireMin + Math.floor(Math.random() * (config.wireMax - config.wireMin + 1));

    // Generate wires WITH duplicates allowed so colour-count rules are satisfiable.
    // We bias toward having at least one duplicate by picking from a smaller pool.
    const poolSize = Math.max(2, Math.min(WIRE_COLORS.length, count - 1));
    const pool = [...WIRE_COLORS].sort(() => Math.random() - 0.5).slice(0, poolSize);
    const shuffled: string[] = [];
    for (let i = 0; i < count; i++) {
      shuffled.push(pool[Math.floor(Math.random() * pool.length)]);
    }

    // Only pick a rule that actually has a valid cut on this wire set.
    const candidateRules = RULES.filter(r => shuffled.some(c => r.check(shuffled, c)));
    const rule = (candidateRules.length > 0
      ? candidateRules[Math.floor(Math.random() * candidateRules.length)]
      : RULES[2]); // fallback: "Não cortes o fio PRETO"

    // Number duplicate-color wires so player can disambiguate ("VERDE #1", "VERDE #2")
    const colorCounts: Record<string, number> = {};
    shuffled.forEach(c => { colorCounts[c] = (colorCounts[c] || 0) + 1; });
    const colorSeen: Record<string, number> = {};
    const wireRows = shuffled.map((c, i) => {
      const baseName = COLOR_NAMES[c] ?? c.toUpperCase();
      let label = baseName;
      if (colorCounts[c] > 1) {
        colorSeen[c] = (colorSeen[c] || 0) + 1;
        label = `${baseName} #${colorSeen[c]}`;
      }
      return `
      <button class="mg-wire ${c}" id="mg-wire-${i}" data-idx="${i}" data-color="${c}" style="border:none">
        <div class="mg-wire-line" style="background:${COLOR_BG[c]}"></div>
        <span style="font-weight:900;font-size:18px">${label}</span>
        <small>CORTAR</small>
      </button>`;
    }).join("");

    container.innerHTML = `
      <div class="mg-wire-wrap">
        <div class="mg-rule-box" style="color:#e0f2fe;text-align:center">
          📋 <b>${rule.text}</b>
        </div>
        <div class="mg-wire-list" id="mg-wire-list">${wireRows}</div>
        <div class="mg-readout">
          <div class="mg-metric">
            <b style="color:#8ea0b8;font-size:12px;letter-spacing:.1em;text-transform:uppercase">Tempo</b>
            <div class="mg-bar"><i id="mg-time-bar" style="width:100%"></i></div>
          </div>
          <div class="mg-metric">
            <b style="color:#8ea0b8;font-size:12px;letter-spacing:.1em;text-transform:uppercase">Fios cortados</b>
            <div style="color:#e5edf9;font-size:20px;font-weight:900;text-align:center" id="mg-cut-count">0 / 1</div>
          </div>
        </div>
      </div>`;

    const timeBar = container.querySelector("#mg-time-bar") as HTMLElement;
    const cutCountEl = container.querySelector("#mg-cut-count") as HTMLElement;

    const onClick = (e: Event) => {
      if (finished) return;
      const btn = (e.target as HTMLElement).closest("[data-color]") as HTMLElement | null;
      if (!btn) return;
      const color = btn.dataset.color ?? "";
      const idx = parseInt(btn.dataset.idx ?? "0");
      const correct = rule.check(shuffled, color);

      if (correct) {
        btn.style.opacity = "0.4";
        btn.style.pointerEvents = "none";
        btn.querySelector("small")!.textContent = "✓ CORTADO";
        cutCount++;
        cutCountEl.textContent = `${cutCount} / 1`;
        cbRef.current.onFeedback("✅ Fio certo cortado!");
        finished = true;
        cbRef.current.onSuccess("Fios cortados! Sistema desativado! ✂️");
      } else {
        btn.classList.add("mg-flash-bad");
        cbRef.current.onFeedback("❌ Fio errado! Alarme!");
        finished = true;
        cbRef.current.onFail("Fio errado! Alarme disparado!");
      }
      void idx; // suppress unused
    };

    container.querySelector("#mg-wire-list")!.addEventListener("click", onClick);

    function update(dt: number) {
      if (finished) return;
      timeLeft -= dt;
      const pct = Math.max(0, timeLeft / config.wireTime) * 100;
      timeBar.style.width = `${pct}%`;
      if (pct < 30) timeBar.parentElement?.classList.add("mg-danger");
      if (timeLeft <= 0) {
        finished = true;
        cbRef.current.onFail("Tempo esgotado! Explosão!");
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

  return <div ref={containerRef} className="w-full flex items-center justify-center min-h-[300px]" />;
}
