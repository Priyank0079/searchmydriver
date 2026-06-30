import { Gem, ArrowRight, ShieldCheck } from 'lucide-react';
import { SUBSCRIPTION_BANNER } from '../constants/serviceCatalog';

const SubscriptionBanner = ({ onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="
        group relative w-full overflow-hidden text-left
        rounded-[20px] border border-[#2E1E55] shadow-lg
        bg-gradient-to-br from-[#120A2C] via-[#1B123B] to-[#0A051C]
        transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-purple-950/20
        active:scale-[0.99] min-h-[165px] sm:min-h-[185px] cursor-pointer flex flex-col justify-between
      "
    >
      {/* Premium neon glow behind illustration */}
      <div className="absolute -right-8 -bottom-8 w-44 h-44 sm:w-56 sm:h-56 rounded-full bg-gradient-to-br from-violet-600/25 to-fuchsia-600/25 blur-2xl pointer-events-none" />
      <div className="absolute left-1/3 top-1/4 w-28 h-28 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

      {/* Decorative dot matrix / mesh glow on background */}
      <div className="absolute right-12 top-4 w-20 h-20 opacity-15 pointer-events-none bg-[radial-gradient(#a855f7_1px,transparent_1px)] [background-size:8px_8px] rounded-full" />

      {/* Main content grid */}
      <div className="relative p-4 sm:p-5 z-10 flex-1 flex flex-col justify-between pr-[38%] sm:pr-[42%]">
        {/* Top: Premium badge */}
        <div>
          <div className="flex items-center gap-1.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center text-white shadow-md shadow-fuchsia-500/20">
              <Gem className="w-3.5 h-3.5 animate-pulse" />
            </div>
            <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-widest text-fuchsia-300">
              Premium
            </span>
          </div>

          {/* Heading with styled gradient text */}
          <h3 className="text-lg sm:text-xl font-black text-white leading-tight tracking-tight mt-3">
            Need a driver <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 via-purple-300 to-indigo-300">for the month?</span>
          </h3>

          <p className="text-[11px] sm:text-xs text-slate-300/85 mt-1 max-w-xs font-semibold leading-normal">
            Get a dedicated driver for your daily commute.
          </p>
        </div>

        {/* Bottom CTA & Trust indicators */}
        <div className="mt-4 sm:mt-5 flex items-center flex-wrap gap-2.5">
          {/* Book Now Button */}
          <span className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-white text-[11px] sm:text-xs font-extrabold shadow-lg shadow-purple-500/20 group-hover:scale-105 transition-transform duration-200">
            Book Now
            <ArrowRight className="w-3 h-3" />
          </span>

          {/* Divider & Trust */}
          <div className="hidden xs:flex items-center">
            <div className="h-6 w-[1px] bg-slate-700/60 mx-2.5" />
            <div className="flex items-center gap-1">
              <ShieldCheck className="w-4 h-4 text-fuchsia-400 shrink-0" />
              <div className="text-[8px] leading-tight text-slate-400 font-extrabold tracking-wide uppercase">
                <p>Trusted.</p>
                <p>Reliable.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Illustration sitting on bottom right */}
      <div className="absolute right-0 bottom-0 w-[36%] sm:w-[40%] max-h-full pointer-events-none select-none flex items-end justify-end z-0">
        <img
          src={SUBSCRIPTION_BANNER.imageSrc}
          alt="Premium Subscription"
          loading="lazy"
          decoding="async"
          className="max-h-[82%] sm:max-h-[90%] w-auto object-contain object-bottom-right drop-shadow-2xl transition-all duration-500 group-hover:scale-[1.04] group-hover:-translate-y-0.5"
        />
      </div>
    </button>
  );
};

export default SubscriptionBanner;
