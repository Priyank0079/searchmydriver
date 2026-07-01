import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ServiceCard from './ServiceCard';
import SubscriptionBanner from './SubscriptionBanner';
import { SERVICE_CATALOG_LIST } from '../constants/serviceCatalog';
import { useCachedQuery } from '../../../../hooks/useCachedQuery';
import { buildCacheKey } from '../../../../store/lib/buildCacheKey';
import {
  useUserServicePricingsStore,
} from '../../../../store/user/useUserPricingStore';
import useBookingDraftStore from '../../../../store/user/useBookingDraftStore';
import { SERVICE_TYPES } from '../../../../constants/serviceTypes';

/**
 * "Book a driver" home section.
 *
 * Renders the two service tiles (Hourly + Outstation) and the subscription
 * banner. All data comes from the public pricing endpoints — if the API
 * hasn't loaded yet we still render the tiles with their fallback copy
 * (no jarring spinner here, it's a marketing section).
 *
 * Tapping a tile:
 *   1. Preselects the service in the booking draft so we can skip the
 *      service-picker screen entirely.
 *   2. Jumps straight to the pickup step.
 *
 * Tapping the subscription banner navigates to the subscriptions page.
 */
const BookDriverSection = () => {
  const navigate = useNavigate();
  const setServiceType = useBookingDraftStore((s) => s.setServiceType);

  const { data: pricingData } = useCachedQuery(
    useUserServicePricingsStore,
    buildCacheKey('user-services-active'),
  );

  // Map serviceType → pricing row for the "From ₹X" hint.
  const pricingByType = useMemo(() => {
    const list = Array.isArray(pricingData) ? pricingData : [];
    return list.reduce((acc, row) => {
      acc[row.serviceType] = row;
      return acc;
    }, {});
  }, [pricingData]);



  const handleServiceTap = (serviceType) => {
    setServiceType(serviceType);
    if (serviceType === SERVICE_TYPES.HOURLY) {
      // Hourly has its own dedicated flow (instant/scheduled → details → slab).
      navigate('/user/book/hourly/type');
    } else {
      navigate('/user/book/outstation/type');
    }
  };

  return (
    <section className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
      <header className="flex flex-col items-center text-center mb-4 mt-1">
        <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight relative inline-block">
          Book a driver
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-[3px] bg-primary rounded-full" />
        </h2>
        <p className="text-[11px] sm:text-xs text-text-secondary mt-1.5 font-bold uppercase tracking-wider opacity-90">
          Choose what fits your day.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        {SERVICE_CATALOG_LIST.map((catalog, idx) => {
          const pricing = pricingByType[catalog.key];
          return (
            <ServiceCard
              key={catalog.key}
              serviceKey={catalog.key}
              title={catalog.title}
              tagline={catalog.tagline}
              priceLabel={catalog.priceLabel(pricing)}
              ctaHint={catalog.ctaHint}
              imageSrc={catalog.imageSrc}
              imageAlt={`${catalog.title} service`}
              gradient={catalog.gradient}
              accent={catalog.accent}
              accentText={catalog.accentText}
              onClick={() => handleServiceTap(catalog.key)}
              style={{ animationDelay: `${0.1 + idx * 0.05}s` }}
            />

          );
        })}
      </div>

      <div className="mt-4">
        <SubscriptionBanner
          onClick={() => navigate('/user/book/monthly/type')}
        />
      </div>
    </section>
  );
};

export default BookDriverSection;
