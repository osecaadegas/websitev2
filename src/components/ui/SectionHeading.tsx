"use client";

interface SectionHeadingProps {
  title: string;
  subtitle?: string;
  className?: string;
  subtitleClassName?: string;
}

export function SectionHeading({ title, subtitle, className = "", subtitleClassName = "" }: SectionHeadingProps) {
  return (
    <div className={`text-center mb-12 ${className}`}>
      <h2 className="gladiator-title text-3xl sm:text-4xl lg:text-5xl">
        {title}
      </h2>
      {subtitle && (
        <p className={`mt-3 gladiator-subtitle text-sm sm:text-base max-w-2xl mx-auto ${subtitleClassName}`}>
          {subtitle}
        </p>
      )}
      {/* Decorative divider */}
      <div className={`mt-6 flex items-center justify-center gap-3 ${subtitleClassName}`}>
        <div className="h-px w-12 bg-gradient-to-r from-transparent to-arena-gold/40" />
        <span className="text-arena-gold/60 text-xs">⚔</span>
        <div className="h-px w-12 bg-gradient-to-l from-transparent to-arena-gold/40" />
      </div>
    </div>
  );
}
