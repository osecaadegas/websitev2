"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface ChatEntry {
  twitch_id: string;
  twitch_username: string;
  tickets: number;
  timestamp: number;
}

interface TwitchChatListenerProps {
  channel: string;
  enabled: boolean;
  chatCommand: string;
  onEntry?: (entry: ChatEntry) => void;
  onStatusChange?: (status: "connected" | "disconnected" | "connecting") => void;
}

/**
 * Twitch IRC WebSocket listener.
 * Connects to irc-ws.chat.twitch.tv anonymously, listens for giveaway commands,
 * and forwards entries to the chat-entry API endpoint.
 */
export function useTwitchChatListener({
  channel,
  enabled,
  chatCommand,
  onEntry,
  onStatusChange,
}: TwitchChatListenerProps) {
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<"connected" | "disconnected" | "connecting">("disconnected");
  const [recentEntries, setRecentEntries] = useState<ChatEntry[]>([]);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const updateStatus = useCallback(
    (s: "connected" | "disconnected" | "connecting") => {
      setStatus(s);
      onStatusChange?.(s);
    },
    [onStatusChange]
  );

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    updateStatus("connecting");

    const ws = new WebSocket("wss://irc-ws.chat.twitch.tv:443");
    wsRef.current = ws;

    ws.onopen = () => {
      // Anonymous connection (justinfan)
      const nick = `justinfan${Math.floor(10000 + Math.random() * 90000)}`;
      ws.send("CAP REQ :twitch.tv/tags twitch.tv/commands");
      ws.send(`NICK ${nick}`);
      ws.send(`JOIN #${channel.toLowerCase()}`);
    };

    ws.onmessage = (event) => {
      const lines = event.data.split("\r\n").filter(Boolean);
      for (const line of lines) {
        // Respond to PING
        if (line.startsWith("PING")) {
          ws.send("PONG :tmi.twitch.tv");
          continue;
        }

        // Connected confirmation
        if (line.includes("366")) {
          updateStatus("connected");
          continue;
        }

        // PRIVMSG — chat message
        if (line.includes("PRIVMSG")) {
          handleMessage(line);
        }
      }
    };

    ws.onclose = () => {
      updateStatus("disconnected");
      if (enabledRef.current) {
        reconnectTimer.current = setTimeout(connect, 3000);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [channel, updateStatus]);

  const handleMessage = useCallback(
    (raw: string) => {
      if (!enabledRef.current) return;

      // Parse Twitch IRC tags
      const tagPart = raw.startsWith("@") ? raw.split(" ")[0].substring(1) : "";
      const tags: Record<string, string> = {};
      if (tagPart) {
        for (const pair of tagPart.split(";")) {
          const [key, val] = pair.split("=");
          tags[key] = val || "";
        }
      }

      // Extract message text
      const msgMatch = raw.match(/PRIVMSG\s+#\S+\s+:(.+)/);
      if (!msgMatch) return;

      const msgText = msgMatch[1].trim();
      const cmd = chatCommand.toLowerCase();
      const parts = msgText.toLowerCase().split(/\s+/);

      if (parts[0] !== cmd) return;

      const userId = tags["user-id"];
      const displayName = tags["display-name"] || "unknown";
      const ticketArg = parseInt(parts[1]) || 1;

      if (!userId) return;

      // Forward to API
      const chatSecret = process.env.NEXT_PUBLIC_GIVEAWAY_CHAT_SECRET;
      fetch("/api/giveaways/chat-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          twitch_id: userId,
          twitch_username: displayName,
          command: parts[0],
          args: parts.slice(1),
          secret: chatSecret,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            const entry: ChatEntry = {
              twitch_id: userId,
              twitch_username: displayName,
              tickets: data.tickets,
              timestamp: Date.now(),
            };
            setRecentEntries((prev) => [entry, ...prev].slice(0, 50));
            onEntry?.(entry);
          }
        })
        .catch(() => {});
    },
    [chatCommand, onEntry]
  );

  // Connect/disconnect based on enabled
  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      updateStatus("disconnected");
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
    };
  }, [enabled, connect, updateStatus]);

  return { status, recentEntries };
}
