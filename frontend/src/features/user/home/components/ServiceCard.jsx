import { ArrowRight } from 'lucide-react';

const ServiceCard = ({
  title,
  tagline,
  priceLabel,
  ctaHint,
  imageSrc,
  imageAlt,
  gradient,
  accent,
  accentText = 'text-text',
  onClick,
  loading = false,
  style,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      className={`
        group relative w-full overflow-hidden text-left
        rounded-2xl sm:rounded-3xl bg-gradient-to-br ${gradient}
        border border-white/70 shadow-card
        transition-transform duration-200 active:scale-[0.98]
        hover:shadow-lg min-h-[130px] sm:min-h-[150px]
      `}
    >
      {/* Decorative blob behind the illustration */}
      <div
        className="absolute -right-6 -bottom-6 w-24 h-24 sm:-right-8 sm:-bottom-8 sm:w-32 sm:h-32 rounded-full blur-2xl opacity-40 pointer-events-none"
        style={{ backgroundColor: accent }}
      />

      {/* Hero illustration — bottom-right corner (size unchanged) */}
      <div className="absolute bottom-0 right-0 w-20 h-20 sm:w-28 sm:h-28 pointer-events-none select-none">
        <img
          src={imageSrc}
          alt={imageAlt || title}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-contain object-bottom-right drop-shadow-md transition-transform duration-300 group-hover:scale-105"
        />
      </div>

      {/* Content column — reduced padding on mobile */}
      <div className="relative p-2.5 sm:p-3.5 pr-16 sm:pr-20 flex flex-col min-h-[140px] sm:min-h-[170px]">
        <div>
          <h3 className={`text-sm sm:text-base font-extrabold leading-tight ${accentText}`}>{title}</h3>
          <p className="text-[10px] sm:text-[11px] text-text-secondary">
            {tagline}
          </p>

          {/* Price chip — placed right under the heading + tagline */}
          {priceLabel && (
            <span
              className="mt-1.5 sm:mt-2 inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-wide px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full bg-white border whitespace-nowrap shadow-sm w-auto"
              style={{ color: accent, borderColor: `${accent}40` }}
            >
              <span>{priceLabel}</span>
              <ArrowRight className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
            </span>
          )}
        </div>

        {ctaHint && (
          <p className="mt-auto pt-2 sm:pt-3 text-[9px] sm:text-[10px] text-text-muted truncate">{ctaHint}</p>
        )}
      </div>

      {loading && (
        <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] animate-pulse pointer-events-none" />
      )}
    </button>
  );
};

export default ServiceCard;
