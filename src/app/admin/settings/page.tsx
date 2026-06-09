"use client";

import { useAuth } from "@/lib/auth-context";
import { hasRole } from "@/lib/roles";
import { useEffect, useState, useCallback, useRef } from "react";
import { EFFECT_OPTIONS } from "@/components/PageEffects";
import type { PageSetting } from "@/hooks/usePageSettings";

type Tab = "image" | "effects" | "access";

/* ── Reusable slider ──────────────────────────────────────── */
function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  prefixIcon,
  suffixIcon,
  onChange,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
  prefixIcon?: string;
  suffixIcon?: string;
  onChange: (v: number) => void;
  onCommit: (v: number) => void;
}) {
  const display = format ? format(value) : `${value}`;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-medium text-arena-smoke/70 uppercase tracking-wider">
          {label}
        </label>
        <span className="text-[11px] text-arena-smoke/50 tabular-nums">{display}</span>
      </div>
      <div className="flex items-center gap-2">
        {prefixIcon && <span className="text-[10px] text-arena-smoke/30">{prefixIcon}</span>}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          onMouseUp={(e) => onCommit(Number((e.target as HTMLInputElement).value))}
          onTouchEnd={(e) => onCommit(Number((e.target as HTMLInputElement).value))}
          className="flex-1 h-1.5 accent-[var(--arena-gold,#d4a843)]"
        />
        {suffixIcon && <span className="text-[10px] text-arena-smoke/30">{suffixIcon}</span>}
      </div>
    </div>
  );
}

/* ── Draggable page preview ───────────────────────────────── */
function DragPreview({
  bgImage,
  bgPosX,
  bgPosY,
  bgZoom,
  bgColor,
  bgBrightness,
  bgSaturation,
  bgContrast,
  overlayOpacity,
  onPositionChange,
  onPositionCommit,
  onZoomChange,
  onZoomCommit,
}: {
  bgImage: string | null;
  bgPosX: number;
  bgPosY: number;
  bgZoom: number;
  bgColor: string;
  bgBrightness: number;
  bgSaturation: number;
  bgContrast: number;
  overlayOpacity: number;
  onPositionChange: (x: number, y: number) => void;
  onPositionCommit: (x: number, y: number) => void;
  onZoomChange: (zoom: number) => void;
  onZoomCommit: (zoom: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const startBgPos = useRef({ x: bgPosX, y: bgPosY });

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!containerRef.current) return;
    isDragging.current = true;
    startPos.current = { x: e.clientX, y: e.clientY };
    startBgPos.current = { x: bgPosX, y: bgPosY };
    containerRef.current.setPointerCapture(e.pointerId);
    containerRef.current.style.cursor = "grabbing";
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dx = e.clientX - startPos.current.x;
    const dy = e.clientY - startPos.current.y;
    // Map pixel delta to % — invert so dragging right moves image right (lower bg-position-x feel)
    const pctX = (dx / rect.width) * -100;
    const pctY = (dy / rect.height) * -100;
    const newX = Math.min(100, Math.max(0, startBgPos.current.x + pctX));
    const newY = Math.min(100, Math.max(0, startBgPos.current.y + pctY));
    onPositionChange(Math.round(newX), Math.round(newY));
  };

  const handlePointerUp = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (containerRef.current) containerRef.current.style.cursor = "grab";
    onPositionCommit(bgPosX, bgPosY);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -5 : 5;
    const newZoom = Math.min(200, Math.max(50, bgZoom + delta));
    onZoomChange(newZoom);
    onZoomCommit(newZoom);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-medium text-arena-smoke/70 uppercase tracking-wider">
          Pré-visualização (arrasta para posicionar, scroll para zoom)
        </label>
        <span className="text-[10px] text-arena-smoke/40 tabular-nums">
          X:{bgPosX}% Y:{bgPosY}% Z:{bgZoom}%
        </span>
      </div>
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        className="relative w-full rounded-lg overflow-hidden border border-white/10 select-none touch-none"
        style={{ aspectRatio: "16/9", cursor: "grab" }}
      >
        {/* Background color fill (gap color) */}
        <div className="absolute inset-0" style={{ backgroundColor: bgColor }} />

        {/* Background image */}
        {bgImage && (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url('${bgImage}')`,
              backgroundSize: `${bgZoom}%`,
              backgroundPosition: `${bgPosX}% ${bgPosY}%`,
              backgroundRepeat: "no-repeat",
              filter: `brightness(${bgBrightness}) saturate(${bgSaturation}) contrast(${bgContrast})`,
            }}
          />
        )}

        {/* Overlay */}
        <div
          className="absolute inset-0"
          style={{ backgroundColor: `rgba(0,0,0,${overlayOpacity})` }}
        />

        {/* Page layout wireframe overlay */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Navbar */}
          <div className="absolute top-0 left-0 right-0 h-[8%] bg-black/60 border-b border-arena-gold/20 flex items-center px-3">
            <div className="flex gap-1.5 items-center">
              <div className="w-3 h-3 rounded-full bg-arena-gold/40" />
              <div className="w-10 h-1.5 rounded-full bg-white/20" />
            </div>
            <div className="flex gap-2 ml-auto">
              <div className="w-6 h-1.5 rounded-full bg-white/10" />
              <div className="w-6 h-1.5 rounded-full bg-white/10" />
              <div className="w-6 h-1.5 rounded-full bg-white/10" />
            </div>
          </div>
          {/* Sidebar */}
          <div className="absolute top-[8%] left-0 w-[15%] bottom-0 bg-black/40 border-r border-white/5 hidden lg:block">
            <div className="flex flex-col gap-2 p-2 mt-2">
              <div className="w-full h-1.5 rounded-full bg-white/10" />
              <div className="w-3/4 h-1.5 rounded-full bg-white/10" />
              <div className="w-full h-1.5 rounded-full bg-white/10" />
              <div className="w-2/3 h-1.5 rounded-full bg-arena-gold/20" />
            </div>
          </div>
          {/* Content area */}
          <div className="absolute top-[12%] lg:left-[18%] left-[5%] right-[5%] flex flex-col items-center gap-2">
            <div className="w-1/2 h-2.5 rounded-full bg-white/15" />
            <div className="w-1/3 h-1.5 rounded-full bg-white/8" />
            <div className="mt-2 w-3/4 grid grid-cols-3 gap-1.5">
              <div className="aspect-[3/4] rounded bg-white/[0.06] border border-white/5" />
              <div className="aspect-[3/4] rounded bg-white/[0.06] border border-white/5" />
              <div className="aspect-[3/4] rounded bg-white/[0.06] border border-white/5" />
            </div>
          </div>
        </div>

        {/* Drag crosshair indicator */}
        {!bgImage && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-arena-smoke/30 text-xs">Sem imagem</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Mobile Drag Preview (9:16 portrait) ──────────────────── */
function MobileDragPreview({
  bgImage,
  bgPosX,
  bgPosY,
  bgZoom,
  bgColor,
  bgBrightness,
  bgSaturation,
  bgContrast,
  overlayOpacity,
  onPositionChange,
  onPositionCommit,
  onZoomChange,
  onZoomCommit,
}: {
  bgImage: string | null;
  bgPosX: number;
  bgPosY: number;
  bgZoom: number;
  bgColor: string;
  bgBrightness: number;
  bgSaturation: number;
  bgContrast: number;
  overlayOpacity: number;
  onPositionChange: (x: number, y: number) => void;
  onPositionCommit: (x: number, y: number) => void;
  onZoomChange: (zoom: number) => void;
  onZoomCommit: (zoom: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const startBgPos = useRef({ x: bgPosX, y: bgPosY });

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!containerRef.current) return;
    isDragging.current = true;
    startPos.current = { x: e.clientX, y: e.clientY };
    startBgPos.current = { x: bgPosX, y: bgPosY };
    containerRef.current.setPointerCapture(e.pointerId);
    containerRef.current.style.cursor = "grabbing";
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dx = e.clientX - startPos.current.x;
    const dy = e.clientY - startPos.current.y;
    const pctX = (dx / rect.width) * -100;
    const pctY = (dy / rect.height) * -100;
    const newX = Math.min(100, Math.max(0, startBgPos.current.x + pctX));
    const newY = Math.min(100, Math.max(0, startBgPos.current.y + pctY));
    onPositionChange(Math.round(newX), Math.round(newY));
  };

  const handlePointerUp = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (containerRef.current) containerRef.current.style.cursor = "grab";
    onPositionCommit(bgPosX, bgPosY);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -5 : 5;
    const newZoom = Math.min(200, Math.max(50, bgZoom + delta));
    onZoomChange(newZoom);
    onZoomCommit(newZoom);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-medium text-arena-smoke/70 uppercase tracking-wider">
          Pré-visualização Mobile (arrasta para posicionar, scroll para zoom)
        </label>
        <span className="text-[10px] text-arena-smoke/40 tabular-nums">
          X:{bgPosX}% Y:{bgPosY}% Z:{bgZoom}%
        </span>
      </div>
      {/* Centred portrait phone mockup */}
      <div className="flex justify-center">
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
          className="relative rounded-[18px] overflow-hidden border-2 border-blue-400/30 select-none touch-none shadow-lg"
          style={{ width: 140, height: 248, cursor: "grab" }}
        >
          <div className="absolute inset-0" style={{ backgroundColor: bgColor }} />
          {bgImage && (
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url('${bgImage}')`,
                backgroundSize: `${bgZoom}%`,
                backgroundPosition: `${bgPosX}% ${bgPosY}%`,
                backgroundRepeat: "no-repeat",
                filter: `brightness(${bgBrightness}) saturate(${bgSaturation}) contrast(${bgContrast})`,
              }}
            />
          )}
          <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${overlayOpacity})` }} />
          {/* Phone UI wireframe */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Status bar */}
            <div className="absolute top-0 left-0 right-0 h-[8%] bg-black/50 flex items-center justify-center">
              <div className="w-10 h-1 rounded-full bg-black/80 mt-1" />
            </div>
            {/* Navbar */}
            <div className="absolute top-[8%] left-0 right-0 h-[10%] bg-black/60 border-b border-arena-gold/20 flex items-center px-2">
              <div className="w-2 h-2 rounded-full bg-arena-gold/40 mr-1" />
              <div className="w-8 h-1 rounded-full bg-white/20" />
              <div className="ml-auto w-3 h-3 rounded bg-white/10" />
            </div>
            {/* Content */}
            <div className="absolute top-[22%] left-[8%] right-[8%] flex flex-col gap-1.5">
              <div className="w-3/4 h-1.5 rounded-full bg-white/20" />
              <div className="w-1/2 h-1 rounded-full bg-white/10" />
              <div className="mt-1 grid grid-cols-2 gap-1">
                <div className="aspect-square rounded bg-white/[0.06] border border-white/5" />
                <div className="aspect-square rounded bg-white/[0.06] border border-white/5" />
              </div>
            </div>
            {/* Bottom bar */}
            <div className="absolute bottom-0 left-0 right-0 h-[8%] bg-black/50 flex items-center justify-center">
              <div className="w-16 h-1 rounded-full bg-white/20" />
            </div>
          </div>
          {!bgImage && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-arena-smoke/30 text-[10px]">Sem imagem</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Per-page settings card ───────────────────────────────── */
function PageSettingsCard({
  page,
  isHome,
  isPageUploading,
  uploadTarget,
  saving,
  setSettings,
  saveField,
  triggerUpload,
}: {
  page: PageSetting;
  isHome: boolean;
  isPageUploading: boolean;
  uploadTarget: { id: string; field: string } | null;
  saving: string | null;
  setSettings: React.Dispatch<React.SetStateAction<PageSetting[]>>;
  saveField: (id: string, updates: Partial<PageSetting>) => Promise<void>;
  triggerUpload: (id: string, slug: string, field: "background_image" | "hero_image" | "mobile_background_image") => void;
}) {
  const [activeTab, setActiveTab] = useState<Tab>("image");

  const updateLocal = (field: string, value: number | string) => {
    setSettings((prev) =>
      prev.map((s) => (s.id === page.id ? { ...s, [field]: value } : s))
    );
  };

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "image", label: "Imagem & Posição", icon: "🖼️" },
    { key: "effects", label: "Efeitos & Filtros", icon: "✨" },
    { key: "access", label: "Visibilidade & Acesso", icon: "🔒" },
  ];

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 px-5 py-3 bg-white/[0.02]">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-arena-gold font-[family-name:var(--font-display)] truncate">
            {page.page_name}
          </h3>
          <span className="text-[11px] text-arena-smoke/50 font-mono">
            /{page.page_slug === "home" ? "" : page.page_slug}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {page.effect !== "none" && (
            <span className="px-2 py-0.5 rounded-md bg-arena-gold/10 text-arena-gold text-[11px] font-medium">
              {EFFECT_OPTIONS.find((e) => e.value === page.effect)?.icon}{" "}
              {EFFECT_OPTIONS.find((e) => e.value === page.effect)?.label}
            </span>
          )}
          {page.background_image && (
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[11px] font-medium">
              🖼️ Fundo
            </span>
          )}
          {isHome && page.hero_image && (
            <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 text-[11px] font-medium">
              🏛️ Hero
            </span>
          )}
        </div>
      </div>

      {/* Tab buttons */}
      <div className="flex border-t border-b border-white/5">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium transition-all ${
              activeTab === tab.key
                ? "bg-arena-gold/10 text-arena-gold border-b-2 border-arena-gold"
                : "text-arena-smoke/60 hover:text-arena-smoke hover:bg-white/[0.03]"
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="px-5 py-4">
        {activeTab === "image" && (
          <div className="space-y-4">
            {/* Image pickers row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ImageField
                label="Imagem de Fundo"
                value={page.background_image}
                isUploading={isPageUploading && uploadTarget?.field === "background_image"}
                onUpload={() => triggerUpload(page.id, page.page_slug, "background_image")}
                onClear={() => saveField(page.id, { background_image: "" } as Partial<PageSetting>)}
                onSelectPreset={(url) => saveField(page.id, { background_image: url } as Partial<PageSetting>)}
              />
              {isHome && (
                <ImageField
                  label="Imagem Hero (Landing)"
                  value={page.hero_image}
                  isUploading={isPageUploading && uploadTarget?.field === "hero_image"}
                  onUpload={() => triggerUpload(page.id, page.page_slug, "hero_image")}
                  onClear={() => saveField(page.id, { hero_image: "" } as Partial<PageSetting>)}
                  onSelectPreset={(url) => saveField(page.id, { hero_image: url } as Partial<PageSetting>)}
                />
              )}
            </div>

            {/* Hero text inputs (only for home page) */}
            {isHome && (
              <div className="space-y-3 p-4 rounded-lg border border-white/10 bg-white/[0.02]">
                <h4 className="text-xs font-semibold text-arena-gold uppercase tracking-wider">
                  Texto do Hero (Landing)
                </h4>
                
                {/* Hero Title */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-arena-smoke/70 uppercase tracking-wider">
                    Título Principal
                  </label>
                  <input
                    type="text"
                    value={page.hero_title ?? ""}
                    placeholder="ENTER THE ARENA"
                    onChange={(e) => updateLocal("hero_title", e.target.value)}
                    onBlur={(e) => saveField(page.id, { hero_title: e.target.value } as Partial<PageSetting>)}
                    className="w-full px-3 py-2 rounded-md bg-black/40 border border-white/10 text-white placeholder:text-arena-smoke/30 focus:outline-none focus:border-arena-gold/50 transition-colors text-sm"
                  />
                </div>

                {/* Hero Description */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-arena-smoke/70 uppercase tracking-wider">
                    Descrição
                  </label>
                  <textarea
                    value={page.hero_description ?? ""}
                    placeholder="A brutal cinematic iGaming coliseum..."
                    onChange={(e) => updateLocal("hero_description", e.target.value)}
                    onBlur={(e) => saveField(page.id, { hero_description: e.target.value } as Partial<PageSetting>)}
                    rows={3}
                    className="w-full px-3 py-2 rounded-md bg-black/40 border border-white/10 text-white placeholder:text-arena-smoke/30 focus:outline-none focus:border-arena-gold/50 transition-colors text-sm resize-none"
                  />
                </div>

                {/* Font Size Controls */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <Slider
                    label="Tamanho do Título"
                    value={page.hero_title_size ?? 1.0}
                    min={0.5}
                    max={2.0}
                    step={0.05}
                    format={(v) => `${(v * 100).toFixed(0)}%`}
                    onChange={(v) => updateLocal("hero_title_size", v)}
                    onCommit={(v) => saveField(page.id, { hero_title_size: v } as Partial<PageSetting>)}
                  />
                  <Slider
                    label="Tamanho da Descrição"
                    value={page.hero_description_size ?? 1.0}
                    min={0.5}
                    max={2.0}
                    step={0.05}
                    format={(v) => `${(v * 100).toFixed(0)}%`}
                    onChange={(v) => updateLocal("hero_description_size", v)}
                    onCommit={(v) => saveField(page.id, { hero_description_size: v } as Partial<PageSetting>)}
                  />
                </div>

                {/* Text Alignment */}
                <div className="space-y-1.5 pt-2">
                  <label className="text-[11px] font-medium text-arena-smoke/70 uppercase tracking-wider">
                    Alinhamento do Texto
                  </label>
                  <select
                    value={page.hero_text_align ?? "left"}
                    onChange={(e) => {
                      const value = e.target.value as "left" | "center" | "right";
                      updateLocal("hero_text_align", value);
                      saveField(page.id, { hero_text_align: value } as Partial<PageSetting>);
                    }}
                    className="w-full px-3 py-2 rounded-md bg-black/40 border border-white/10 text-white focus:outline-none focus:border-arena-gold/50 transition-colors text-sm"
                  >
                    <option value="left">Esquerda</option>
                    <option value="center">Centro</option>
                    <option value="right">Direita</option>
                  </select>
                </div>

                {/* Position and Width Controls */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <Slider
                    label="Posição Horizontal"
                    value={page.hero_position_x ?? 6}
                    min={0}
                    max={100}
                    step={1}
                    format={(v) => `${v}%`}
                    onChange={(v) => updateLocal("hero_position_x", v)}
                    onCommit={(v) => saveField(page.id, { hero_position_x: v } as Partial<PageSetting>)}
                  />
                  <Slider
                    label="Posição Vertical"
                    value={page.hero_position_y ?? 32}
                    min={0}
                    max={100}
                    step={1}
                    format={(v) => `${v}%`}
                    onChange={(v) => updateLocal("hero_position_y", v)}
                    onCommit={(v) => saveField(page.id, { hero_position_y: v } as Partial<PageSetting>)}
                  />
                </div>

                {/* Max Width */}
                <div className="pt-2">
                  <Slider
                    label="Largura Máxima do Texto"
                    value={page.hero_max_width ?? 768}
                    min={300}
                    max={1920}
                    step={50}
                    format={(v) => `${v}px`}
                    onChange={(v) => updateLocal("hero_max_width", v)}
                    onCommit={(v) => saveField(page.id, { hero_max_width: v } as Partial<PageSetting>)}
                  />
                </div>
              </div>
            )}

            {/* Color picker for gap fill */}
            <div className="flex items-center gap-3">
              <label className="text-[11px] font-medium text-arena-smoke/70 uppercase tracking-wider whitespace-nowrap">
                Cor de Fundo (preenche espaços vazios)
              </label>
              <input
                type="color"
                value={page.bg_color ?? "#000000"}
                onChange={(e) => updateLocal("bg_color", e.target.value)}
                onBlur={(e) => saveField(page.id, { bg_color: e.target.value } as Partial<PageSetting>)}
                className="w-8 h-8 rounded border border-white/20 cursor-pointer bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded [&::-webkit-color-swatch]:border-none"
              />
              <span className="text-[11px] text-arena-smoke/40 font-mono">{page.bg_color ?? "#000000"}</span>
            </div>

            {/* Drag preview with page layout */}
            <DragPreview
              bgImage={page.background_image}
              bgPosX={page.bg_position_x ?? 50}
              bgPosY={page.bg_position_y ?? 50}
              bgZoom={page.bg_zoom ?? 100}
              bgColor={page.bg_color ?? "#000000"}
              bgBrightness={page.bg_brightness ?? 0.35}
              bgSaturation={page.bg_saturation ?? 0.7}
              bgContrast={page.bg_contrast ?? 0.95}
              overlayOpacity={page.overlay_opacity ?? 0.6}
              onPositionChange={(x, y) => { updateLocal("bg_position_x", x); updateLocal("bg_position_y", y); }}
              onPositionCommit={(x, y) => saveField(page.id, { bg_position_x: x, bg_position_y: y } as Partial<PageSetting>)}
              onZoomChange={(z) => updateLocal("bg_zoom", z)}
              onZoomCommit={(z) => saveField(page.id, { bg_zoom: z } as Partial<PageSetting>)}
            />

            {/* Zoom slider below preview */}
            <Slider
              label="Zoom"
              value={page.bg_zoom ?? 100}
              min={50} max={200} step={5}
              format={(v) => `${v}%`}
              onChange={(v) => updateLocal("bg_zoom", v)}
              onCommit={(v) => saveField(page.id, { bg_zoom: v } as Partial<PageSetting>)}
            />

            {/* ── Mobile image section ───────────────────── */}
            <div className="mt-2 rounded-xl border border-blue-400/20 bg-blue-500/[0.04] overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-blue-400/10">
                <span className="text-lg">📱</span>
                <div>
                  <h4 className="text-xs font-semibold text-blue-300 uppercase tracking-wider">Imagem Mobile</h4>
                  <p className="text-[11px] text-arena-smoke/50 mt-0.5">Substitui a imagem de fundo em ecrãs pequenos (&lt;768px). Deixa vazio para usar a imagem de desktop.</p>
                </div>
              </div>
              <div className="p-4 space-y-4">
                <ImageField
                  label="Imagem Mobile"
                  value={page.mobile_background_image ?? null}
                  isUploading={isPageUploading && uploadTarget?.field === "mobile_background_image"}
                  onUpload={() => triggerUpload(page.id, page.page_slug, "mobile_background_image")}
                  onClear={() => saveField(page.id, { mobile_background_image: "" } as Partial<PageSetting>)}
                  onSelectPreset={(url) => saveField(page.id, { mobile_background_image: url } as Partial<PageSetting>)}
                />

                {page.mobile_background_image && (
                  <>
                    {/* Mobile portrait drag preview */}
                    <MobileDragPreview
                      bgImage={page.mobile_background_image}
                      bgPosX={page.mobile_bg_position_x ?? 50}
                      bgPosY={page.mobile_bg_position_y ?? 50}
                      bgZoom={page.mobile_bg_zoom ?? 100}
                      bgColor={page.bg_color ?? "#000000"}
                      bgBrightness={page.bg_brightness ?? 0.35}
                      bgSaturation={page.bg_saturation ?? 0.7}
                      bgContrast={page.bg_contrast ?? 0.95}
                      overlayOpacity={page.overlay_opacity ?? 0.6}
                      onPositionChange={(x, y) => { updateLocal("mobile_bg_position_x", x); updateLocal("mobile_bg_position_y", y); }}
                      onPositionCommit={(x, y) => saveField(page.id, { mobile_bg_position_x: x, mobile_bg_position_y: y } as Partial<PageSetting>)}
                      onZoomChange={(z) => updateLocal("mobile_bg_zoom", z)}
                      onZoomCommit={(z) => saveField(page.id, { mobile_bg_zoom: z } as Partial<PageSetting>)}
                    />
                    <Slider
                      label="Zoom Mobile"
                      value={page.mobile_bg_zoom ?? 100}
                      min={50} max={200} step={5}
                      format={(v) => `${v}%`}
                      onChange={(v) => updateLocal("mobile_bg_zoom", v)}
                      onCommit={(v) => saveField(page.id, { mobile_bg_zoom: v } as Partial<PageSetting>)}
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "effects" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: Effect selector + intensity */}
            <div className="space-y-3">
              <label className="text-[11px] font-medium text-arena-smoke/70 uppercase tracking-wider">
                Efeito Visual
              </label>
              <div className="grid grid-cols-1 gap-1">
                {EFFECT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => saveField(page.id, { effect: opt.value } as Partial<PageSetting>)}
                    disabled={saving === page.id}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all text-left ${
                      page.effect === opt.value
                        ? "bg-arena-gold/20 text-arena-gold border border-arena-gold/30"
                        : "bg-white/5 text-arena-smoke hover:bg-white/10 border border-transparent"
                    }`}
                  >
                    <span>{opt.icon}</span>
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
              <Slider
                label="Intensidade do Efeito"
                value={page.effect_intensity}
                min={0.2} max={2} step={0.1}
                format={(v) => v.toFixed(1)}
                onChange={(v) => updateLocal("effect_intensity", v)}
                onCommit={(v) => saveField(page.id, { effect_intensity: v } as Partial<PageSetting>)}
              />
            </div>

            {/* Right: Filters */}
            <div className="space-y-3">
              <Slider
                label="Opacidade do Overlay"
                value={page.overlay_opacity}
                min={0} max={1} step={0.05}
                format={(v) => `${(v * 100).toFixed(0)}%`}
                onChange={(v) => updateLocal("overlay_opacity", v)}
                onCommit={(v) => saveField(page.id, { overlay_opacity: v } as Partial<PageSetting>)}
              />
              <Slider
                label="Brilho"
                value={page.bg_brightness ?? 0.35}
                min={0} max={1} step={0.05}
                format={(v) => `${(v * 100).toFixed(0)}%`}
                onChange={(v) => updateLocal("bg_brightness", v)}
                onCommit={(v) => saveField(page.id, { bg_brightness: v } as Partial<PageSetting>)}
              />
              <Slider
                label="Saturação"
                value={page.bg_saturation ?? 0.7}
                min={0} max={2} step={0.05}
                format={(v) => `${(v * 100).toFixed(0)}%`}
                onChange={(v) => updateLocal("bg_saturation", v)}
                onCommit={(v) => saveField(page.id, { bg_saturation: v } as Partial<PageSetting>)}
              />
              <Slider
                label="Contraste"
                value={page.bg_contrast ?? 0.95}
                min={0} max={2} step={0.05}
                format={(v) => `${(v * 100).toFixed(0)}%`}
                onChange={(v) => updateLocal("bg_contrast", v)}
                onCommit={(v) => saveField(page.id, { bg_contrast: v } as Partial<PageSetting>)}
              />
            </div>
          </div>
        )}

        {activeTab === "access" && (
          <div className="space-y-4">
            {/* Page Active Toggle */}
            <div className="space-y-2 p-4 rounded-lg border border-white/10 bg-white/[0.02]">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-arena-smoke/70 uppercase tracking-wider">
                    Estado da Página
                  </label>
                  <p className="text-[10px] text-arena-smoke/40">
                    Desativar a página esconde-a de todos os utilizadores
                  </p>
                </div>
                <button
                  onClick={() => saveField(page.id, { is_active: !page.is_active } as Partial<PageSetting>)}
                  disabled={saving === page.id}
                  className={`relative w-14 h-7 rounded-full transition-colors ${
                    page.is_active ? "bg-green-500" : "bg-red-500/50"
                  } ${saving === page.id ? "opacity-50" : ""}`}
                >
                  <div
                    className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                      page.is_active ? "translate-x-7" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
              <div className={`text-[10px] font-medium ${
                page.is_active ? "text-green-400" : "text-red-400"
              }`}>
                {page.is_active ? "✓ Página Ativa" : "✗ Página Desativada"}
              </div>
            </div>

            {/* Minimum Role Required */}
            <div className="space-y-2 p-4 rounded-lg border border-white/10 bg-white/[0.02]">
              <label className="text-[11px] font-medium text-arena-smoke/70 uppercase tracking-wider">
                Nível Mínimo de Acesso
              </label>
              <p className="text-[10px] text-arena-smoke/40 mb-3">
                Define o cargo mínimo necessário para visualizar esta página
              </p>
              <select
                value={page.min_role ?? "viewer"}
                onChange={(e) => {
                  const value = e.target.value as "viewer" | "moderador" | "configurador" | "admin";
                  saveField(page.id, { min_role: value } as Partial<PageSetting>);
                }}
                disabled={saving === page.id}
                className="w-full px-3 py-2 rounded-md bg-black/40 border border-white/10 text-white focus:outline-none focus:border-arena-gold/50 transition-colors text-sm"
              >
                <option value="viewer">👁️ Viewer (Todos)</option>
                <option value="moderador">🛡️ Moderador</option>
                <option value="configurador">⚙️ Configurador</option>
                <option value="admin">🔑 Admin</option>
              </select>
              <div className="text-[10px] text-arena-smoke/40 mt-2">
                {page.min_role === "viewer" && "Página visível para todos os utilizadores"}
                {page.min_role === "moderador" && "Página visível apenas para Moderadores, Configuradores e Admins"}
                {page.min_role === "configurador" && "Página visível apenas para Configuradores e Admins"}
                {page.min_role === "admin" && "Página visível apenas para Admins"}
              </div>
            </div>

            {/* Info Box */}
            <div className="p-4 rounded-lg border border-blue-500/20 bg-blue-500/5">
              <div className="flex gap-2">
                <span className="text-blue-400 text-sm">ℹ️</span>
                <div className="text-[11px] text-blue-300/70 leading-relaxed">
                  <strong className="text-blue-300">Nota:</strong> Se a página estiver desativada, nenhum utilizador conseguirá aceder, independentemente do seu cargo. As definições de acesso por cargo só se aplicam quando a página está ativa.
                </div>
              </div>
            </div>
          </div>
        )}

        {saving === page.id && (
          <div className="text-xs text-arena-gold animate-pulse mt-3">A guardar...</div>
        )}
      </div>
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────── */
export default function AdminSettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const [settings, setSettings] = useState<PageSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<{
    id: string;
    slug: string;
    field: "background_image" | "hero_image" | "mobile_background_image";
  } | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  /* ── Fetch settings ─────────────────────────────────────── */
  useEffect(() => {
    fetch("/api/page-settings")
      .then((r) => r.json())
      .then((data) => setSettings(data.settings ?? []))
      .catch(() => showToast("Erro ao carregar definições"))
      .finally(() => setLoading(false));
  }, [showToast]);

  /* ── Keyboard navigation ────────────────────────────────── */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only allow keyboard nav when not focused in an input
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement).tagName)) return;

      if (e.key === "ArrowLeft" && currentPageIndex > 0) {
        e.preventDefault();
        setCurrentPageIndex((prev) => prev - 1);
      } else if (e.key === "ArrowRight" && currentPageIndex < settings.length - 1) {
        e.preventDefault();
        setCurrentPageIndex((prev) => prev + 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentPageIndex, settings.length]);

  /* ── Save a field ───────────────────────────────────────── */
  const saveField = useCallback(
    async (id: string, updates: Partial<PageSetting>) => {
      setSaving(id);
      try {
        const res = await fetch("/api/page-settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, ...updates }),
        });
        if (!res.ok) throw new Error("Failed");
        const { setting } = await res.json();
        setSettings((prev) =>
          prev.map((s) => (s.id === id ? { ...s, ...setting } : s))
        );
        showToast("Guardado ✓");
      } catch {
        showToast("Erro ao guardar");
      } finally {
        setSaving(null);
      }
    },
    [showToast]
  );

  /* ── Upload image ───────────────────────────────────────── */
  const handleUpload = useCallback(
    async (file: File) => {
      if (!uploadTarget) return;
      setUploading(uploadTarget.id);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("page_slug", uploadTarget.slug);
        formData.append("field", uploadTarget.field);

        const res = await fetch("/api/upload-image", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Upload failed");
        }

        const { url } = await res.json();
        await saveField(uploadTarget.id, {
          [uploadTarget.field]: url,
        } as Partial<PageSetting>);
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Erro no upload");
      } finally {
        setUploading(null);
        setUploadTarget(null);
      }
    },
    [uploadTarget, saveField, showToast]
  );

  const triggerUpload = (id: string, slug: string, field: "background_image" | "hero_image" | "mobile_background_image") => {
    setUploadTarget({ id, slug, field });
    setTimeout(() => fileInputRef.current?.click(), 50);
  };

  /* ── Auth gate ──────────────────────────────────────────── */
  if (authLoading) {
    return (
      <div className="pt-24 pb-16 min-h-screen flex items-center justify-center">
        <div className="text-arena-smoke text-lg animate-pulse">A carregar...</div>
      </div>
    );
  }

  if (!user || !hasRole(user.role, "configurador")) {
    return (
      <div className="pt-24 pb-16 min-h-screen flex items-center justify-center">
        <div className="text-red-400 text-lg">Acesso negado - Apenas configuradores e administradores</div>
      </div>
    );
  }

  return (
    <div className="pt-24 pb-16 min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
            e.target.value = "";
          }}
        />

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-arena-gold font-[family-name:var(--font-display)]">
            Definições de Páginas
          </h1>
          <p className="mt-1.5 text-arena-smoke text-sm">
            Configura imagens, posição, efeitos e filtros para cada página.
            <span className="text-arena-smoke/40"> As alterações aplicam-se em tempo real.</span>
          </p>
        </div>

        {loading ? (
          <div className="text-arena-smoke animate-pulse">A carregar páginas...</div>
        ) : settings.length === 0 ? (
          <div className="text-arena-smoke/60">Nenhuma página encontrada</div>
        ) : (
          <>
            {/* Page Navigation */}
            <div className="flex items-center gap-4 mb-6">
              {/* Previous Button */}
              <button
                onClick={() => setCurrentPageIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentPageIndex === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-all group"
              >
                <svg className="w-4 h-4 text-arena-gold group-disabled:text-arena-smoke/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-sm font-medium text-arena-smoke group-disabled:text-arena-smoke/30">Anterior</span>
              </button>

              {/* Page Selector Dropdown */}
              <div className="flex-1 relative">
                <select
                  value={currentPageIndex}
                  onChange={(e) => setCurrentPageIndex(Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-lg border border-white/10 bg-black/40 text-arena-gold font-medium text-sm appearance-none cursor-pointer hover:border-arena-gold/40 focus:outline-none focus:border-arena-gold/60 transition-all"
                >
                  {settings.map((page, index) => (
                    <option key={page.id} value={index} className="bg-black text-white">
                      {page.page_name} {page.page_slug === "home" ? "🏛️" : ""}
                    </option>
                  ))}
                </select>
                <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-arena-gold/60 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {/* Page Counter */}
              <div className="px-4 py-2 rounded-lg border border-white/10 bg-white/[0.02] text-arena-smoke/70 text-sm font-medium tabular-nums whitespace-nowrap">
                {currentPageIndex + 1} / {settings.length}
              </div>

              {/* Next Button */}
              <button
                onClick={() => setCurrentPageIndex((prev) => Math.min(settings.length - 1, prev + 1))}
                disabled={currentPageIndex === settings.length - 1}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-all group"
              >
                <span className="text-sm font-medium text-arena-smoke group-disabled:text-arena-smoke/30">Próxima</span>
                <svg className="w-4 h-4 text-arena-gold group-disabled:text-arena-smoke/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Current Page Card */}
            <PageSettingsCard
              key={settings[currentPageIndex].id}
              page={settings[currentPageIndex]}
              isHome={settings[currentPageIndex].page_slug === "home"}
              isPageUploading={uploading === settings[currentPageIndex].id}
              uploadTarget={uploadTarget}
              saving={saving}
              setSettings={setSettings}
              saveField={saveField}
              triggerUpload={triggerUpload}
            />
          </>
        )}

        {/* Toast */}
        {toast && (
          <div className="fixed right-6 z-50 px-4 py-2 rounded-lg bg-arena-gold/90 text-black font-medium text-sm shadow-lg animate-[fadeIn_0.2s_ease-out]" style={{ bottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}>
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Preset images now loaded dynamically from /api/preset-images ─ */

/* ── Image field with preset gallery + upload ──────────────── */
function ImageField({
  label,
  value,
  isUploading,
  onUpload,
  onClear,
  onSelectPreset,
}: {
  label: string;
  value: string | null;
  isUploading: boolean;
  onUpload: () => void;
  onClear: () => void;
  onSelectPreset: (url: string) => void;
}) {
  const [showGallery, setShowGallery] = useState(false);
  const [presets, setPresets] = useState<{ file: string; name: string }[]>([]);
  const [presetsLoading, setPresetsLoading] = useState(false);

  useEffect(() => {
    if (!showGallery || presets.length > 0) return;
    setPresetsLoading(true);
    fetch("/api/preset-images", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => { if (Array.isArray(j.images)) setPresets(j.images); })
      .catch(() => {})
      .finally(() => setPresetsLoading(false));
  }, [showGallery, presets.length]);

  return (
    <div className="space-y-2">
      <label className="text-[11px] font-medium text-arena-smoke/70 uppercase tracking-wider">
        {label}
      </label>

      {value ? (
        <div className="space-y-1.5">
          <div className="relative w-full h-20 rounded-lg overflow-hidden border border-white/10 group">
            <img src={value} alt={label} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <button
                onClick={() => setShowGallery(true)}
                className="px-2.5 py-1 rounded-md bg-arena-gold/80 text-black text-[11px] font-medium hover:bg-arena-gold transition-colors"
              >
                Alterar
              </button>
              <button
                onClick={onClear}
                className="px-2.5 py-1 rounded-md bg-red-500/80 text-white text-[11px] font-medium hover:bg-red-500 transition-colors"
              >
                Remover
              </button>
            </div>
          </div>
          <p className="text-[10px] text-arena-smoke/40 truncate" title={value}>{value}</p>
        </div>
      ) : (
        <button
          onClick={() => setShowGallery(true)}
          disabled={isUploading}
          className="w-full h-20 rounded-lg border-2 border-dashed border-white/15 hover:border-arena-gold/40 bg-white/[0.02] hover:bg-white/[0.04] transition-all flex flex-col items-center justify-center gap-1.5 group"
        >
          {isUploading ? (
            <div className="w-4 h-4 border-2 border-arena-gold/30 border-t-arena-gold rounded-full animate-spin" />
          ) : (
            <>
              <svg className="w-5 h-5 text-arena-smoke/40 group-hover:text-arena-gold/60 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
              </svg>
              <span className="text-[11px] text-arena-smoke/40 group-hover:text-arena-smoke/60 transition-colors">
                Escolher imagem
              </span>
            </>
          )}
        </button>
      )}

      {/* Gallery Modal */}
      {showGallery && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setShowGallery(false)}
        >
          <div
            className="bg-arena-dark border border-white/10 rounded-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden shadow-2xl mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div>
                <h3 className="text-lg font-semibold text-arena-gold font-[family-name:var(--font-display)]">
                  Escolher Imagem
                </h3>
                <p className="text-xs text-arena-smoke/60 mt-0.5">
                  Seleciona uma imagem predefinida ou faz upload da tua
                </p>
              </div>
              <button onClick={() => setShowGallery(false)} className="text-arena-smoke/60 hover:text-white text-xl px-2">
                ✕
              </button>
            </div>

            <div className="overflow-y-auto max-h-[55vh] p-4">
              {presetsLoading && presets.length === 0 ? (
                <div className="text-center text-arena-smoke/60 text-sm py-8">A carregar imagens…</div>
              ) : presets.length === 0 ? (
                <div className="text-center text-arena-smoke/60 text-sm py-8">Nenhuma imagem encontrada.</div>
              ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {presets.map((img) => {
                  const isSelected = value === img.file;
                  return (
                    <button
                      key={img.file}
                      onClick={() => { onSelectPreset(img.file); setShowGallery(false); }}
                      className={`group relative rounded-lg overflow-hidden border-2 transition-all aspect-[4/3] ${
                        isSelected
                          ? "border-arena-gold ring-2 ring-arena-gold/30"
                          : "border-white/10 hover:border-arena-gold/50"
                      }`}
                    >
                      <img
                        src={img.file}
                        alt={img.name}
                        className="w-full h-full object-cover bg-black/30"
                        loading="lazy"
                        onError={(e) => {
                          const el = e.currentTarget as HTMLImageElement;
                          el.style.opacity = "0.2";
                          el.alt = "(falhou)";
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <span className="absolute bottom-0 left-0 right-0 text-[10px] text-white font-medium px-1.5 py-1 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity truncate text-center">
                        {img.name}
                      </span>
                      {isSelected && (
                        <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-arena-gold flex items-center justify-center">
                          <span className="text-black text-xs font-bold">✓</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-white/10 flex items-center justify-between">
              <p className="text-xs text-arena-smoke/50">Nenhuma serve? Faz upload da tua imagem (máx. 5 MB)</p>
              <button
                onClick={() => { setShowGallery(false); onUpload(); }}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-arena-smoke text-xs font-medium transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                Carregar imagem
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
