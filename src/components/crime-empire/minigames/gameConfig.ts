export type GameDifficulty = "low" | "medium" | "high";

export const GAME_CONFIGS = {
  low: {
    label: "Fácil",
    lockTol: 20, lockOpen: 64, lockBreak: 8,
    safeTol: 4.8, safeOver: 13, safeWrong: 10, safeSpeed: 33,
    wireMin: 4, wireMax: 5, wireTime: 28,
    hackGrid: 3, hackStart: 3, hackRounds: 3, hackStep: 0.72,
    thermZone: 0.28, thermGrace: 2.6, thermDuration: 12, thermSpeed: 0.85, thermAccel: 0.018,
    keypadWidth: 0.24, keypadSpeed: 0.55, keypadHits: 4, keypadMisses: 4, keypadShrink: 0.006,
    panicLen: 5, panicTime: 13, panicMistakes: 4,
  },
  medium: {
    label: "Médio",
    lockTol: 13, lockOpen: 54, lockBreak: 13,
    safeTol: 3.4, safeOver: 9, safeWrong: 7, safeSpeed: 43,
    wireMin: 5, wireMax: 7, wireTime: 20,
    hackGrid: 3, hackStart: 4, hackRounds: 4, hackStep: 0.56,
    thermZone: 0.22, thermGrace: 1.75, thermDuration: 14, thermSpeed: 1.05, thermAccel: 0.028,
    keypadWidth: 0.18, keypadSpeed: 0.74, keypadHits: 5, keypadMisses: 3, keypadShrink: 0.011,
    panicLen: 7, panicTime: 10, panicMistakes: 3,
  },
  high: {
    label: "Difícil",
    lockTol: 8, lockOpen: 45, lockBreak: 20,
    safeTol: 2.2, safeOver: 5.5, safeWrong: 4.5, safeSpeed: 56,
    wireMin: 7, wireMax: 8, wireTime: 13,
    hackGrid: 4, hackStart: 5, hackRounds: 5, hackStep: 0.42,
    thermZone: 0.15, thermGrace: 1.05, thermDuration: 16, thermSpeed: 1.28, thermAccel: 0.04,
    keypadWidth: 0.13, keypadSpeed: 0.95, keypadHits: 6, keypadMisses: 2, keypadShrink: 0.017,
    panicLen: 9, panicTime: 7.5, panicMistakes: 2,
  },
} as const;

export type GameConfig = (typeof GAME_CONFIGS)[GameDifficulty];

export const GAME_IDS = ["lockpick", "safe", "wires", "hack", "thermite", "keypad", "panic"] as const;
export type GameId = (typeof GAME_IDS)[number];

export const GAME_META: Record<GameId, { name: string; desc: string; icon: string }> = {
  lockpick: { name: "Arrombamento",    desc: "Angula a ferramenta, aplica tensão, não a partes.",             icon: "🔓" },
  safe:     { name: "Cofre",           desc: "Gira o disco pelos números ocultos em direções alternadas.",      icon: "🔐" },
  wires:    { name: "Cortar Fios",     desc: "Lê a regra, corta um fio, bate o contador.",                      icon: "✂️" },
  hack:     { name: "Hacking",         desc: "Memoriza e repete o padrão crescente da grelha.",                 icon: "💻" },
  thermite: { name: "Termite",         desc: "Mantém o indicador dentro da banda segura.",                      icon: "🔥" },
  keypad:   { name: "Teclado",         desc: "Acerta nas janelas de tempo enquanto encolhem.",                  icon: "⌨️" },
  panic:    { name: "Fuga em Pânico",  desc: "Limpa a sequência antes que o medidor encha.",                   icon: "🏃" },
};
