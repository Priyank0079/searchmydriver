import { Sparkles, ArrowRight, Check } from 'lucide-react';
import { SUBSCRIPTION_BANNER } from '../constants/serviceCatalog';

const SubscriptionBanner = ({ onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="
        group relative w-full overflow-hidden text-left
        rounded-2xl shadow-lg transition-transform duration-200 active:scale-[0.99]
        bg-gradient-to-br from-[#1F1B2E] via-[#2D2640] to-[#4F3F89]
        min-h-[200px] sm:min-h-[280px]
      "
    >
      {/* Soft decorative glows - reduced size for mobile */}
      <div className="absolute -left-8 -top-8 w-28 h-28 sm:w-44 sm:h-44 rounded-full bg-primary/10 blur-2xl pointer-events-none" />
      <div className="absolute right-4 -bottom-4 w-32 h-32 sm:right-6 sm:-bottom-6 sm:w-52 sm:h-52 rounded-full bg-primary/20 blur-3xl pointer-events-none" />

      {/* Hero illustration — bottom-right corner - smaller on mobile */}
      <div className="absolute bottom-0 right-0 w-32 sm:w-48 md:w-56 pointer-events-none select-none">
        <img
          src={SUBSCRIPTION_BANNER.imageSrc}
          alt="Subscription"
          loading="lazy"
          decoding="async"
          className="w-full h-auto object-contain object-bottom drop-shadow-2xl transition-transform duration-300 group-hover:scale-[1.04]"
        />
      </div>

      {/* Content column - reduced padding on mobile */}
      <div className="relative p-4 sm:p-5 flex flex-col min-h-[200px] sm:min-h-[280px]">
        {/* Top row: badge (left) + starting price (right) */}
        <div className="flex items-start justify-between gap-2 sm:gap-3">
          <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-primary/15 border border-primary/30 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-primary">
            <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            Premium
          </span>

          <div className="text-right">
            <p className="text-white/60 text-[8px] sm:text-[10px] uppercase tracking-wide leading-none">
              Book for a
            </p>
            <p className="text-white text-sm sm:text-base font-extrabold whitespace-nowrap mt-0.5">
              Month
            </p>
          </div>
        </div>

        {/* Title + tagline + perks — adjusted padding for mobile */}
        <div className="mt-2 sm:mt-3 pr-24 sm:pr-32 md:pr-40">
          <h3 className="text-white text-base sm:text-lg font-extrabold leading-tight">
            Need a driver for the month?
          </h3>
          <p className="text-white/70 text-[11px] sm:text-xs mt-0.5 sm:mt-1 line-clamp-2">
            Get a dedicated driver for your daily commute.
          </p>
        </div>

        {/* See plans CTA - smaller on mobile */}
        <div className="mt-auto pt-3 sm:pt-5">
          <span className="inline-flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2.5 rounded-full bg-primary text-dark text-[11px] sm:text-xs font-bold shadow-md group-hover:translate-x-0.5 transition-transform">
            Book Now
            <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </span>
        </div>
      </div>
    </button>
  );
};

export default SubscriptionBanner;


// import { Sparkles, ArrowRight, Check } from 'lucide-react';
// import { SUBSCRIPTION_BANNER } from '../constants/serviceCatalog';

// const SubscriptionBanner = ({ startingPrice, onClick }) => {
//   return (
//     <button
//       type="button"
//       onClick={onClick}
//       className="
//         group relative w-full overflow-hidden text-left
//         rounded-3xl shadow-lg transition-transform duration-200 active:scale-[0.99]
//         bg-gradient-to-br from-[#1F1B2E] via-[#2D2640] to-[#4F3F89]
//         min-h-[280px]
//       "
//     >
//       {/* Soft decorative glows */}
//       <div className="absolute -left-12 -top-12 w-44 h-44 rounded-full bg-primary/10 blur-2xl pointer-events-none" />
//       <div className="absolute right-6 -bottom-6 w-52 h-52 rounded-full bg-primary/20 blur-3xl pointer-events-none" />

//       {/* Hero illustration — bottom-right corner */}
//       <div className="absolute bottom-0 right-0 w-48 sm:w-56 pointer-events-none select-none">
//         <img
//           src={SUBSCRIPTION_BANNER.imageSrc}
//           alt="Subscription"
//           loading="lazy"
//           decoding="async"
//           className="w-full h-auto object-contain object-bottom drop-shadow-2xl transition-transform duration-300 group-hover:scale-[1.04]"
//         />
//       </div>

//       {/* Content column */}
//       <div className="relative p-5 flex flex-col min-h-[280px]">
//         {/* Top row: badge (left) + starting price (right) */}
//         <div className="flex items-start justify-between gap-3">
//           <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/15 border border-primary/30 text-[10px] font-bold uppercase tracking-wider text-primary">
//             <Sparkles className="w-3 h-3" />
//             Premium
//           </span>

//           {startingPrice ? (
//             <div className="text-right">
//               <p className="text-white/60 text-[10px] uppercase tracking-wide leading-none">
//                 Starting at
//               </p>
//               <p className="text-white text-base font-extrabold whitespace-nowrap mt-0.5">
//                 ₹{startingPrice}
//                 <span className="text-white/70 text-xs font-medium">/mo</span>
//               </p>
//             </div>
//           ) : (
//             <p className="text-white/70 text-[10px] uppercase tracking-wider">Coming soon</p>
//           )}
//         </div>

//         {/* Title + tagline + perks — kept left of the image with right padding */}
//         <div className="mt-3 pr-32 sm:pr-40">
//           <h3 className="text-white text-lg font-extrabold leading-tight">
//             {SUBSCRIPTION_BANNER.title}
//           </h3>
//           <p className="text-white/70 text-xs mt-1 line-clamp-2">
//             {SUBSCRIPTION_BANNER.tagline}
//           </p>
//         </div>

//         {/* See plans CTA pinned to the bottom-left of the content column */}
//         <div className="mt-auto pt-5">
//           <span className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-primary text-dark text-xs font-bold shadow-md group-hover:translate-x-0.5 transition-transform">
//             See plans
//             <ArrowRight className="w-3.5 h-3.5" />
//           </span>
//         </div>
//       </div>
//     </button>
//   );
// };

// export default SubscriptionBanner;
