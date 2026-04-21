"use client";

const VIP_LEVELS = [
  { level: 0, label: "Recruit", icon: "⚔️", color: "text-arena-ash", border: "border-arena-steel" },
  { level: 1, label: "Warrior", icon: "🗡️", color: "text-arena-bronze", border: "border-arena-bronze" },
  { level: 2, label: "Champion", icon: "🏆", color: "text-arena-gold", border: "border-arena-gold/50" },
  { level: 3, label: "Legend", icon: "👑", color: "text-arena-gold-light", border: "border-arena-gold-light/60" },
];

export function getVipLevel(points: number) {
  if (points >= 5000) return 3;
  if (points >= 2000) return 2;
  if (points >= 500) return 1;
  return 0;
}

export function VipBadge({ level }: { level: number }) {
  const vip = VIP_LEVELS[Math.min(level, 3)];
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border ${vip.border} bg-black/40 text-xs gladiator-label ${vip.color}`}>
      <span>{vip.icon}</span>
      <span>{vip.label}</span>
    </span>
  );
}
