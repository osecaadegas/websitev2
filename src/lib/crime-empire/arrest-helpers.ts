import { randomUUID } from "crypto";

/**
 * Generates a one-time escape token for the player to attempt a police escape minigame.
 * The token is valid for 90 seconds after the arrest event.
 */
export function generateEscapeToken() {
  return {
    escape_token: randomUUID(),
    escape_token_expires_at: new Date(Date.now() + 90_000).toISOString(),
  };
}
