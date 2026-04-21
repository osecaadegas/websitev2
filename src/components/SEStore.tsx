"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface StoreItem {
  _id: string;
  name: string;
  description?: string;
  cost: number;
  cooldown?: number;
  enabled: boolean;
  quantity?: { total: number; current: number };
  alert?: { graphics?: { src?: string } };
  thumbnail?: string;
}

export function SEStore() {
  const [items, setItems] = useState<StoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/streamelements?endpoint=store")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setItems(data.filter((i: StoreItem) => i.enabled));
        else setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-64 rounded-2xl bg-white/[0.04] animate-pulse" />
        ))}
      </div>
    );
  }

  if (error || items.length === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 text-center">
        <p className="text-white/50">
          {error ? "Não foi possível carregar a loja." : "Sem itens disponíveis na loja de momento."}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {items.map((item, i) => {
        const thumb = item.thumbnail || item.alert?.graphics?.src;
        const stock = item.quantity;

        return (
          <motion.div
            key={item._id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
            className="group relative rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden hover:border-arena-gold/30 transition-all duration-300"
          >
            {/* Thumbnail */}
            {thumb && (
              <div className="aspect-video w-full overflow-hidden bg-white/[0.03]">
                <img
                  src={thumb}
                  alt={item.name}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
              </div>
            )}

            <div className="p-5">
              <h3 className="font-semibold text-white text-lg">{item.name}</h3>
              {item.description && (
                <p className="mt-1 text-sm text-white/50 line-clamp-2">{item.description}</p>
              )}

              <div className="mt-4 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-arena-gold/30 bg-arena-gold/[0.1] px-3 py-1 text-sm font-bold text-arena-gold">
                  ⭐ {item.cost.toLocaleString("en-US")} pts
                </span>

                {stock && (
                  <span className="text-xs text-white/40">
                    {stock.current}/{stock.total} restantes
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
