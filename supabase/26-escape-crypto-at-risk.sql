-- Add column to track crypto at risk during gambling police raids
ALTER TABLE crime_players
  ADD COLUMN IF NOT EXISTS escape_crypto_at_risk INT NOT NULL DEFAULT 0;
