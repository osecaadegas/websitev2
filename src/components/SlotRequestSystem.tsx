"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Fuse from "fuse.js";
import { ArenaCard } from "@/components/ui/ArenaCard";
import { ArenaButton } from "@/components/ui/ArenaButton";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { TRANSITION_HEAVY } from "@/lib/animations";

/**
 * SLOT REQUEST SYSTEM — Command-style input with fuzzy matching.
 *
 * Features:
 * - !sr command prefix detection
 * - Fuse.js fuzzy search for slot names
 * - Animated queue with scroll animation
 * - Chat-style confirmation messages
 * - Points system toggle
 */

// Known slots for fuzzy matching
const KNOWN_SLOTS = [
  "Gates of Olympus", "Sweet Bonanza", "Wanted Dead or Wild", "Book of Dead",
  "Fruit Party 2", "Mental", "Sugar Rush", "Starlight Princess",
  "Big Bass Bonanza", "Razor Shark", "Fire in the Hole", "Tombstone RIP",
  "San Quentin", "Jammin Jars", "Money Train 3", "Retro Tapes",
  "Dog House Megaways", "Buffalo King Megaways", "Zeus vs Hades",
  "Gems Bonanza", "Wild West Gold", "Extra Chilli",
];

const fuse = new Fuse(KNOWN_SLOTS, {
  threshold: 0.4,
  includeScore: true,
});

interface QueueItem {
  id: string;
  user: string;
  slot: string;
  matchedSlot: string;
  timestamp: Date;
  status: "queued" | "playing" | "done";
}

interface ChatMessage {
  id: string;
  type: "system" | "user" | "success" | "error";
  text: string;
  timestamp: Date;
}

export function SlotRequestSystem({ hideTitle = false }: { hideTitle?: boolean } = {}) {
  const [input, setInput] = useState("");
  const [queue, setQueue] = useState<QueueItem[]>([
    { id: "demo1", user: "GladiatorMax", slot: "gates", matchedSlot: "Gates of Olympus", timestamp: new Date(), status: "playing" },
    { id: "demo2", user: "ArenaKing", slot: "mental", matchedSlot: "Mental", timestamp: new Date(), status: "queued" },
    { id: "demo3", user: "SlotWarrior", slot: "bonanza", matchedSlot: "Sweet Bonanza", timestamp: new Date(), status: "queued" },
  ]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "welcome", type: "system", text: "⚔️ Slot Request System active. Type !sr <slot name> to request.", timestamp: new Date() },
  ]);
  const [pointsEnabled, setPointsEnabled] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    // Check for !sr command
    const srMatch = trimmed.match(/^!sr\s+(.+)/i);
    if (!srMatch) {
      addMessage("error", "Use !sr <slot name> to request a slot.");
      setInput("");
      return;
    }

    const query = srMatch[1];
    const results = fuse.search(query);
    const userName = "Viewer" + Math.floor(Math.random() * 999);

    if (results.length === 0) {
      addMessage("error", `❌ No slot found matching "${query}". Try again.`);
      setInput("");
      return;
    }

    const matched = results[0].item;
    const newItem: QueueItem = {
      id: Date.now().toString(),
      user: userName,
      slot: query,
      matchedSlot: matched,
      timestamp: new Date(),
      status: "queued",
    };

    setQueue((prev) => [...prev, newItem]);
    addMessage("user", `${userName}: !sr ${query}`);
    addMessage("success", `✅ ${matched} added to queue for ${userName}!`);
    setInput("");
  }

  function addMessage(type: ChatMessage["type"], text: string) {
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString() + Math.random(), type, text, timestamp: new Date() },
    ]);
  }

  return (
    <section id="slot-request" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {!hideTitle && (
          <ScrollReveal>
            <SectionHeading
              title="Slot Request"
              subtitle="Command the arena. Request your slots using !sr."
            />
          </ScrollReveal>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Chat panel */}
          <ScrollReveal delay={0.1}>
            <ArenaCard className="p-5 flex flex-col h-[500px]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="gladiator-label text-arena-gold text-sm font-bold">
                  COMMAND CENTER
                </h3>
                <label className="flex items-center gap-2 text-xs text-arena-ash cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pointsEnabled}
                    onChange={(e) => setPointsEnabled(e.target.checked)}
                    className="accent-arena-gold"
                  />
                  Points System
                </label>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto space-y-2 mb-4 pr-2">
                <AnimatePresence>
                  {messages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ type: "spring", stiffness: 200, damping: 20 }}
                      className={`text-sm px-3 py-2 ${
                        msg.type === "system"
                          ? "text-arena-ash bg-arena-iron/30"
                          : msg.type === "error"
                          ? "text-arena-red bg-arena-red/5 border-l-2 border-arena-red/30"
                          : msg.type === "success"
                          ? "text-green-400 bg-green-900/10 border-l-2 border-green-500/30"
                          : "text-arena-white bg-arena-charcoal"
                      }`}
                    >
                      {msg.text}
                    </motion.div>
                  ))}
                </AnimatePresence>
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="!sr slot name..."
                  className="flex-1 bg-arena-iron border border-arena-steel/30 px-4 py-2.5 text-sm text-arena-white placeholder:text-arena-ash focus:outline-none focus:border-arena-gold/40 transition-colors"
                />
                <ArenaButton type="submit" size="sm">
                  Send
                </ArenaButton>
              </form>
            </ArenaCard>
          </ScrollReveal>

          {/* Queue */}
          <ScrollReveal delay={0.2}>
            <ArenaCard className="p-5 h-[500px] flex flex-col">
              <h3 className="gladiator-label text-arena-gold text-sm font-bold mb-4">
                REQUEST QUEUE
              </h3>
              <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                <AnimatePresence>
                  {queue.map((item, i) => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 40, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, x: 100, scale: 0.9 }}
                      transition={TRANSITION_HEAVY}
                      className={`flex items-center gap-3 p-3 border ${
                        item.status === "playing"
                          ? "border-arena-gold/30 bg-arena-gold/5"
                          : "border-arena-steel/15 bg-arena-iron/20"
                      }`}
                    >
                      <span className="gladiator-label text-arena-ash text-xs w-6">
                        #{i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-arena-white truncate">
                          {item.matchedSlot}
                        </p>
                        <p className="text-xs text-arena-ash">{item.user}</p>
                      </div>
                      <span
                        className={`text-xs font-bold tracking-wider ${
                          item.status === "playing" ? "text-arena-gold" : "text-arena-smoke"
                        }`}
                      >
                        {item.status === "playing" ? "⚔️ NOW" : "QUEUED"}
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </ArenaCard>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
