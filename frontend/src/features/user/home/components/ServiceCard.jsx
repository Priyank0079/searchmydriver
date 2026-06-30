import { ArrowRight, Clock, Zap, MapPin, Compass } from 'lucide-react';

const ServiceCard = ({
  title,
  tagline,
  priceLabel,
  ctaHint,
  imageSrc,
  imageAlt,
  gradient,
  accent,
  accentText,
  onClick,
  loading = false,
  style,
  serviceKey,
}) => {
  const isHourly = serviceKey === 'hourly' || title.toLowerCase().includes('hourly');

  // Exact mockup styling matching Image 1
  const cardStyles = isHourly
    ? {
        bgGradient: 'bg-gradient-to-br from-[#FFF7F2] via-[#FFF3EB] to-[#FFF0E6]',
        borderColor: 'border-[#FFE3D1]',
        iconBg: 'bg-[#E88048]',
        iconColor: 'text-white',
        titleColor: 'text-[#2D1A10]',
        taglineColor: 'text-[#7A6456]',
        pillBg: 'bg-white',
        pillText: 'text-[#E88048]',
        pillBorder: 'border-[#FFE3D1]',
        footerBg: 'bg-[#FFF0E6]',
        footerText: 'text-[#D2682F]',
        shadowColor: 'hover:shadow-[#FFF0E6]/50',
      }
    : {
        bgGradient: 'bg-gradient-to-br from-[#F5FCFB] via-[#EBF7FF] to-[#E5F7F5]',
        borderColor: 'border-[#D5EFF7]',
        iconBg: 'bg-[#00BFA6]',
        iconColor: 'text-white',
        titleColor: 'text-[#082925]',
        taglineColor: 'text-[#4D6D6A]',
        pillBg: 'bg-white',
        pillText: 'text-[#008A77]',
        pillBorder: 'border-[#CCEFEA]',
        footerBg: 'bg-[#E5F7F5]',
        footerText: 'text-[#008A77]',
        shadowColor: 'hover:shadow-[#E5F7F5]/50',
      };

  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      className={`
        group relative w-full overflow-hidden text-left flex flex-col justify-between
        rounded-[20px] ${cardStyles.bgGradient}
        border ${cardStyles.borderColor} shadow-sm
        transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${cardStyles.shadowColor}
        active:scale-[0.98] min-h-[170px] sm:min-h-[190px] cursor-pointer
      `}
    >
      {/* Top section with content */}
      <div className="relative p-3 sm:p-4 flex-1 flex flex-col justify-between pr-14 sm:pr-18">
        {/* Top-left icon */}
        <div>
          <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg ${cardStyles.iconBg} ${cardStyles.iconColor} flex items-center justify-center shadow-sm`}>
            {isHourly ? (
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            ) : (
              <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            )}
          </div>

          <h3 className={`text-sm sm:text-base font-extrabold leading-tight mt-2 ${cardStyles.titleColor}`}>
            {title}
          </h3>
          <p className={`text-[11px] sm:text-xs font-semibold leading-tight mt-0.5 ${cardStyles.taglineColor}`}>
            {tagline}
          </p>
        </div>

        {/* Dynamic pricing CTA pill */}
        {priceLabel && (
          <div className="mt-2.5">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full ${cardStyles.pillBg} ${cardStyles.pillText} border ${cardStyles.pillBorder} text-[10px] sm:text-xs font-extrabold tracking-wide shadow-sm group-hover:scale-105 transition-transform duration-200`}
            >
              <span>{priceLabel}</span>
              <ArrowRight className="w-3 h-3 shrink-0" />
            </span>
          </div>
        )}
      </div>

      {/* Hero illustration — Floating animate */}
      <div className="absolute right-1.5 top-3.5 w-14 h-14 sm:w-18 sm:h-18 pointer-events-none select-none animate-float">
        <img
          src={imageSrc}
          alt={imageAlt || title}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-contain drop-shadow-sm transition-transform duration-300 group-hover:scale-110"
        />
      </div>

      {/* Bottom Footer bar */}
      <div className={`w-full py-1.5 sm:py-2 px-3 sm:px-4 flex items-center gap-1.5 text-[10px] sm:text-xs font-extrabold ${cardStyles.footerBg} ${cardStyles.footerText}`}>
        {isHourly ? (
          <Zap className="w-3 h-3 animate-pulse" />
        ) : (
          <Compass className="w-3 h-3 animate-spin" style={{ animationDuration: '6s' }} />
        )}
        <span>{isHourly ? 'Book in seconds' : 'Plan your journey'}</span>
      </div>

      {loading && (
        <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] animate-pulse pointer-events-none" />
      )}
    </button>
  );
};

export default ServiceCard;

