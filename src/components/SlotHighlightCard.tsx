"use client";

interface SlotHighlightCardProps {
  label: string;          // "MELHOR" or "PIOR"
  slotName: string;
  thumbnailUrl?: string;
  payout: number;
  betValue: number;
  currency?: string;
}

export function SlotHighlightCard({
  label,
  slotName,
  thumbnailUrl,
  payout,
  betValue,
  currency = "€",
}: SlotHighlightCardProps) {
  const multi = betValue > 0 ? payout / betValue : 0;
  const isWin = payout >= betValue;

  return (
    <div className="papyrus-scroll greek-key-border" style={{ padding: 0 }}>
      <div style={{
        display: "flex",
        alignItems: "stretch",
        gap: 0,
        borderRadius: "6px",
        overflow: "hidden",
        minHeight: "100px",
      }}>
        {/* Left — Thumbnail */}
        <div style={{ width: "100px", flexShrink: 0, position: "relative" }}>
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={slotName}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : (
            <div style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--papyrus-base, #e8d9b0)",
              fontSize: "1.5rem",
            }}>
              🎰
            </div>
          )}
        </div>

        {/* Right — Info */}
        <div style={{
          flex: 1,
          padding: "14px 18px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: "0px",
          background: "var(--papyrus-base, #e8d9b0)",
        }}>
          {/* Label */}
          <p style={{
            fontFamily: "var(--font-display)",
            fontSize: "0.5rem",
            fontWeight: 700,
            color: label === "Melhor" ? "#2e7d32" : "#8b1a1a",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            marginBottom: "2px",
          }}>{label} Slot</p>

          {/* Slot name */}
          <p style={{
            fontFamily: "var(--font-ui)",
            fontSize: "0.9rem",
            fontWeight: 700,
            color: "var(--ink-dark, #3a2a14)",
            lineHeight: 1.2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            marginBottom: "8px",
          }}>{slotName}</p>

          {/* Payout label */}
          <p style={{ fontFamily: "var(--font-display)", fontSize: "0.45rem", fontWeight: 600, color: "var(--ink-light)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "1px" }}>Payout</p>
          {/* Payout value */}
          <p style={{ fontFamily: "var(--font-ui)", fontSize: "0.95rem", fontWeight: 700, color: isWin ? "#2e7d32" : "#8b1a1a", marginBottom: "8px" }}>{payout.toFixed(2)}{currency}</p>

          {/* Bet Size label */}
          <p style={{ fontFamily: "var(--font-display)", fontSize: "0.45rem", fontWeight: 600, color: "var(--ink-light)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "1px" }}>Bet Size</p>
          {/* Bet Size value */}
          <p style={{ fontFamily: "var(--font-ui)", fontSize: "0.95rem", fontWeight: 600, color: "var(--ink-dark, #3a2a14)", marginBottom: "8px" }}>{betValue.toFixed(2)}{currency}</p>

          {/* Multi label */}
          <p style={{ fontFamily: "var(--font-display)", fontSize: "0.45rem", fontWeight: 600, color: "var(--ink-light)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "1px" }}>Multi</p>
          {/* Multi value */}
          <p style={{ fontFamily: "var(--font-ui)", fontSize: "0.95rem", fontWeight: 700, color: isWin ? "#d4a017" : "#8b1a1a" }}>{multi.toFixed(1)}x</p>
        </div>
      </div>
    </div>
  );
}
