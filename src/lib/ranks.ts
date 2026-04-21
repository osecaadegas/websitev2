/* Gladiator rank configuration */

export const RANKS = [
  { key: "recruit", label: "Recruit", min: 0, color: "#666", icon: "⚔️" },
  { key: "warrior", label: "Warrior", min: 500, color: "#cd7f32", icon: "🗡️" },
  { key: "champion", label: "Champion", min: 2000, color: "#d4a843", icon: "🏆" },
  { key: "legend", label: "Legend", min: 5000, color: "#f0d78c", icon: "👑" },
] as const;

export function getRankForPoints(points: number) {
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (points >= RANKS[i].min) return RANKS[i];
  }
  return RANKS[0];
}

export function getNextRank(points: number) {
  for (const rank of RANKS) {
    if (points < rank.min) return rank;
  }
  return null; // Already at max
}

export function getRankProgress(points: number): number {
  const current = getRankForPoints(points);
  const next = getNextRank(points);
  if (!next) return 100;
  const range = next.min - current.min;
  const progress = points - current.min;
  return Math.min(100, (progress / range) * 100);
}
