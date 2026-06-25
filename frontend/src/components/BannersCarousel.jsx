import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../utils/api';

/**
 * Top banners carousel rendered on the user home screen below the search bar.
 * - Pulls active banners from `GET /common/banners`.
 * - Renders each banner as a 16:9 image card.
 * - Auto-rotates every 5 seconds.
 */
const BannersCarousel = () => {
  const [banners, setBanners] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const scrollerRef = useRef(null);
  const interactingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/common/banners')
      .then((res) => {
        if (cancelled) return;
        setBanners(Array.isArray(res?.data?.data) ? res.data.data : []);
      })
      .catch(() => {
        if (cancelled) return;
        setBanners([]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const scrollToIndex = useCallback((idx) => {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.children?.[idx];
    if (!card) return;
    el.scrollTo({ left: card.offsetLeft - el.offsetLeft, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (banners.length < 2) return undefined;
    const tick = setInterval(() => {
      if (interactingRef.current) return;
      setActiveIdx((prev) => {
        const next = (prev + 1) % banners.length;
        scrollToIndex(next);
        return next;
      });
    }, 5000);
    return () => clearInterval(tick);
  }, [banners.length, scrollToIndex]);

  const handleScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const children = Array.from(el.children);
    if (!children.length) return;
    const center = el.scrollLeft + el.clientWidth / 2;
    let bestIdx = 0;
    let bestDist = Infinity;
    children.forEach((child, idx) => {
      const childCenter = child.offsetLeft + child.clientWidth / 2 - el.offsetLeft;
      const dist = Math.abs(childCenter - center);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = idx;
      }
    });
    setActiveIdx(bestIdx);
  }, []);

  const handleBannerClick = (banner) => {
    if (!banner.linkUrl) return;
    window.open(banner.linkUrl, '_blank', 'noopener,noreferrer');
  };

  if (!loaded || banners.length === 0) return null;

  return (
    <section
      className="animate-fade-in-up mt-4"
      style={{ animationDelay: '0.1s' }}
      aria-label="Top Banners"
    >
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        onTouchStart={() => {
          interactingRef.current = true;
        }}
        onTouchEnd={() => {
          interactingRef.current = false;
        }}
        onMouseEnter={() => {
          interactingRef.current = true;
        }}
        onMouseLeave={() => {
          interactingRef.current = false;
        }}
        className={`flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-4 px-4 scroll-smooth ${banners.length === 1 ? 'justify-center' : ''}`}
      >
        {banners.map((banner) => (
          <BannerCard key={banner._id} banner={banner} onClick={() => handleBannerClick(banner)} />
        ))}
      </div>
      {banners.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-2">
          {banners.map((banner, idx) => (
            <button
              key={banner._id}
              type="button"
              onClick={() => {
                setActiveIdx(idx);
                scrollToIndex(idx);
              }}
              aria-label={`Show banner ${idx + 1}`}
              className={`h-1.5 rounded-full transition-all ${idx === activeIdx ? 'w-5 bg-primary' : 'w-1.5 bg-gray-300'
                }`}
            />
          ))}
        </div>
      )}
    </section>
  );
};

function BannerCard({ banner, onClick }) {
  const clickable = !!banner.linkUrl;
  const Tag = clickable ? 'button' : 'div';
  return (
    <Tag
      type={clickable ? 'button' : undefined}
      onClick={clickable ? onClick : undefined}
      aria-label={banner.title ? `Open: ${banner.title}` : 'Open banner'}
      className={`snap-start shrink-0 w-[88%] max-w-[420px] rounded-2xl overflow-hidden bg-slate-900 shadow-card relative ${clickable ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''
        }`}
    >
      <div className="aspect-[16/9] w-full">
        <img
          src={banner.imageUrl}
          alt={banner.title || 'Promotional banner'}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
    </Tag>
  );
}

export default BannersCarousel;
