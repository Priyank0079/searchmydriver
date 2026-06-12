import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  Check,
  Loader2,
  Calendar,
  Car as CarIcon,
  Plus,
  MapPin,
  Navigation,
  RefreshCw,
  CalendarRange,
  Crosshair,
  Pointer,
  Lock,
  MapPinOff,
  ShieldCheck,
} from 'lucide-react';
import { MarkerF } from '@react-google-maps/api';
import Card from '../../../../components/Card';
import Button from '../../../../components/Button';
import MapView from '../../../../components/maps/MapView';
import AddCarModal from '../components/AddCarModal';
import { MAX_USER_CARS } from '../../../../constants/limits';
import { useCachedQuery } from '../../../../hooks/useCachedQuery';
import { buildCacheKey } from '../../../../store/lib/buildCacheKey';
import { useUserServicePricingsStore } from '../../../../store/user/useUserPricingStore';
import { SERVICE_TYPES, SERVICE_TYPE_LABELS } from '../../../../constants/serviceTypes';
import useBookingDraftStore from '../../../../store/user/useBookingDraftStore';
import {
  computeOutstationDuration,
  defaultPickupInputValue,
  defaultReturnInputValue,
  toDateTimeInputValue,
} from '../../../../utils/outstationSchedule';
import toast from 'react-hot-toast';
import { useGoogleMaps } from '../../../../hooks/useGoogleMaps';
import { useMapPlaceSearch } from '../../../../hooks/useMapPlaceSearch';
import { useDirectionsRoute } from '../../../../hooks/useDirectionsRoute';
import { useZoneCheck } from '../../../../hooks/useZoneCheck';
import RoutePolyline from '../../../../components/maps/RoutePolyline';
import OutOfServiceDialog from '../../../../components/dialogs/OutOfServiceDialog';
import {
  DEFAULT_MAP_CENTER,
  INDIA_MAP_BOUNDS,
} from '../../../../constants/mapDefaults';
import api from '../../../../utils/api';
import { getCarBrandName, getCarModelName } from '../../../../utils/vehicleCatalog';

/**
 * Step 2 — "Plan your trip".
 *
 * After the customer picks Hourly or Outstation on the home tile, we
 * land here. The two flows diverge:
 *
 *   - Hourly:     pickup-time picker + list of duration slabs.
 *                 Continue → /user/book/pickup (Rapido-style map
 *                 + car selector).
 *   - Outstation: pickup + destination autocomplete *and* an embedded
 *                 map (tap / drag to set markers) — return = pickup
 *                 since the trip is round-trip. Pickup time +
 *                 expected return, then car selection. NO fare is
 *                 calculated here — the combined Review + Pay screen
 *                 surfaces the food/stay toggle and the materialised
 *                 fare.
 *                 Continue → /user/book/confirm.
 *
 * Header and Continue CTA are sticky on both branches.
 */
const SelectVariantPage = () => {
  const navigate = useNavigate();
  const serviceType = useBookingDraftStore((s) => s.serviceType);
  const hourlyDraft = useBookingDraftStore((s) => s.hourly);
  const outstationDraft = useBookingDraftStore((s) => s.outstation);
  const setHourly = useBookingDraftStore((s) => s.setHourly);
  const setOutstation = useBookingDraftStore((s) => s.setOutstation);

  const { data, loading } = useCachedQuery(
    useUserServicePricingsStore,
    buildCacheKey('user-services-active'),
  );
  const pricing = useMemo(() => {
    const list = Array.isArray(data) ? data : [];
    return list.find((s) => s.serviceType === serviceType) || null;
  }, [data, serviceType]);

  useEffect(() => {
    if (!serviceType) navigate('/user/book/service', { replace: true });
  }, [serviceType, navigate]);

  if (loading && !pricing) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg min-h-dvh">
        <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
      </div>
    );
  }

  if (serviceType === SERVICE_TYPES.HOURLY) {
    return (
      <HourlyVariants
        pricing={pricing}
        draft={hourlyDraft}
        onPatch={setHourly}
        onContinue={() => navigate('/user/book/pickup')}
      />
    );
  }

  return (
    <OutstationVariants
      pricing={pricing}
      draft={outstationDraft}
      onPatch={setOutstation}
      // Outstation collects everything (location, destination, pickup
      // time, expected return, car) on this page and skips straight to
      // /user/book/confirm — the combined Review + Pay screen — where
      // the food-and-stay toggle controls the fare estimate and the
      // toll/parking acknowledgement gates the wallet debit. The
      // map-only /user/book/pickup screen is only used by the hourly
      // flow now.
      onContinue={() => navigate('/user/book/confirm')}
    />
  );
};

/* ------------------------------------------------------------------ */
/* Hourly                                                              */
/* ------------------------------------------------------------------ */

function HourlyVariants({ pricing, draft, onPatch, onContinue }) {
  const navigate = useNavigate();
  const slabs = pricing?.slabs || [];

  const [selectedSlabId, setSelectedSlabId] = useState(draft.slabId || slabs[0]?._id || null);
  const [scheduledStartAt, setScheduledStartAt] = useState(
    draft.scheduledStartAt
      ? toDateTimeInputValue(draft.scheduledStartAt)
      : defaultIsoForInput(),
  );

  const selectedSlab = slabs.find((s) => s._id === selectedSlabId);

  const handleContinue = () => {
    if (!selectedSlab) return;
    onPatch({
      slabId: selectedSlab._id,
      durationHours: selectedSlab.maxHours || selectedSlab.minHours,
      scheduledStartAt: new Date(scheduledStartAt).toISOString(),
    });
    onContinue();
  };

  return (
    <PageShell
      title={`Choose a ${SERVICE_TYPE_LABELS[SERVICE_TYPES.HOURLY].toLowerCase()} package`}
      subtitle="Pick how long you need the driver — extra hours are billed at the per-hour rate."
      onBack={() => navigate(-1)}
      footer={(
        <Footer
          priceHint="Starts at"
          priceLabel={selectedSlab ? `₹${selectedSlab.price}` : '—'}
          primaryLabel="Continue"
          disabled={!selectedSlab || !scheduledStartAt}
          onClick={handleContinue}
        />
      )}
    >
      <Card>
        <label className="flex items-center gap-2 text-xs font-semibold text-text-muted mb-2">
          <Calendar className="w-3.5 h-3.5" /> Pickup time
        </label>
        <input
          type="datetime-local"
          value={scheduledStartAt}
          min={defaultIsoForInput()}
          onChange={(e) => setScheduledStartAt(e.target.value)}
          className="w-full h-11 bg-gray-50 border border-border rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </Card>

      <div className="space-y-3">
        {slabs.length === 0 && (
          <Card>
            <p className="text-sm text-text-muted text-center py-4">
              No hourly packages are available right now.
            </p>
          </Card>
        )}
        {slabs.map((slab, idx) => {
          const isSelected = slab._id === selectedSlabId;
          return (
            <Card
              key={slab._id}
              onClick={() => setSelectedSlabId(slab._id)}
              hoverable
              className={`animate-fade-in-up ${isSelected ? 'ring-2 ring-primary' : ''}`}
              style={{ animationDelay: `${idx * 0.05}s` }}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    isSelected ? 'bg-primary/15' : 'bg-gray-100'
                  }`}
                >
                  <Clock className={`w-5 h-5 ${isSelected ? 'text-primary' : 'text-text-muted'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm text-text">
                    {slab.label || `${slab.minHours}–${slab.maxHours} hours`}
                  </h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    Up to {slab.maxHours} h · extra ₹{pricing?.extraHourCharge || 0}/hr
                  </p>
                </div>
                <span className="text-sm font-bold text-text">₹{slab.price}</span>
                <RadioDot active={isSelected} />
              </div>
            </Card>
          );
        })}
      </div>
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/* Outstation                                                          */
/* ------------------------------------------------------------------ */

/**
 * Outstation variants page — collects EVERYTHING needed for the round
 * trip on a single screen so the next page (/user/book/confirm) only
 * has to surface the food & stay toggle and the fare breakdown.
 *
 *   Pickup (autocomplete)
 *   Destination (autocomplete) — return = pickup, this is a round trip
 *   Pickup time + expected return time
 *   Car selection
 *
 * No fare is calculated here on purpose — the customer commits to the
 * trip first, then decides on the food/stay arrangement on the
 * combined Review + Pay screen where the fare materialises.
 */
function OutstationVariants({ pricing, draft, onPatch, onContinue }) {
  const navigate = useNavigate();
  const dailyRate = Number(pricing?.outstation?.dailyRate) || 0;
  const allowancePerNight = Number(pricing?.outstation?.allowancePerNight) || 0;

  // Pickup / destination live on the global booking-draft store so
  // they survive a back-navigation from /user/book/confirm.
  const draftPickup = useBookingDraftStore((s) => s.pickup);
  const draftDropoff = useBookingDraftStore((s) => s.dropoff);
  const draftCarId = useBookingDraftStore((s) => s.carId);
  const setPickupStore = useBookingDraftStore((s) => s.setPickup);
  const setDropoffStore = useBookingDraftStore((s) => s.setDropoff);
  const setCarIdStore = useBookingDraftStore((s) => s.setCarId);

  const [localPickup, setLocalPickup] = useState(draftPickup);
  const [localDestination, setLocalDestination] = useState(
    draftDropoff || (draft.destinationAddress
      ? {
          address: draft.destinationAddress,
          lat: draft.destinationLat,
          lng: draft.destinationLng,
        }
      : null),
  );

  const initialPickupTime =
    toDateTimeInputValue(draft.pickupAt || draft.startDate) ||
    defaultPickupInputValue();
  const initialReturnTime =
    toDateTimeInputValue(draft.expectedReturnAt || draft.endDate) ||
    defaultReturnInputValue(initialPickupTime);

  const [pickupAt, setPickupAt] = useState(initialPickupTime);
  const [expectedReturnAt, setExpectedReturnAt] = useState(initialReturnTime);

  // Days = number of distinct calendar dates the trip spans (server
  // mirrors this exact formula). Nights = days − 1.
  const { days, nights } = useMemo(
    () => computeOutstationDuration(pickupAt, expectedReturnAt),
    [pickupAt, expectedReturnAt],
  );

  // Auto-bump return when pickup pushes past it; keeps the diff
  // non-negative without a separate validation toast.
  const onPickupTimeChange = (value) => {
    setPickupAt(value);
    if (
      value &&
      expectedReturnAt &&
      new Date(value).getTime() >= new Date(expectedReturnAt).getTime()
    ) {
      setExpectedReturnAt(defaultReturnInputValue(value));
    }
  };

  /* ------------------------------------------------------------------ */
  /* Place autocomplete + embedded map                                    */
  /* ------------------------------------------------------------------ */

  const { maps, ready: mapsReady } = useGoogleMaps();
  const pickupInputRef = useRef(null);
  const destinationInputRef = useRef(null);

  // Which field a map click should populate — toggled when the user
  // taps a marker chip above the map (or focuses an input). The map
  // click listener reads this via a ref so it doesn't have to re-bind
  // every time the active field changes.
  const [activeField, setActiveField] = useState('pickup');

  // Geocoder is created once the maps SDK is ready. Used to turn
  // marker positions (from a tap or drag) back into a human address
  // for the input fields.
  const geocoderRef = useRef(null);
  useEffect(() => {
    if (!maps || geocoderRef.current) return;
    geocoderRef.current = new maps.Geocoder();
  }, [maps]);

  // We restrict every coordinate the user can pin to India. The
  // bounding-box check is a cheap first pass (no API call needed)
  // and the geocoder country-code check is the authoritative fallback
  // for points that fall inside the bounding box but outside the
  // actual border (Pakistan, Bangladesh, Bhutan, parts of Nepal, etc.).
  const reverseGeocode = useCallback(async ({ lat, lng }) => {
    const fallback = {
      address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      city: '',
      country: null,
      lat,
      lng,
    };
    const geocoder = geocoderRef.current;
    if (!geocoder) return fallback;
    try {
      const result = await new Promise((resolve, reject) => {
        geocoder.geocode({ location: { lat, lng } }, (res, status) => {
          if (status === 'OK') resolve(res);
          else reject(new Error(status));
        });
      });
      const top = result?.[0];
      const cityComp = top?.address_components?.find((c) =>
        c.types?.some((t) =>
          ['locality', 'administrative_area_level_2'].includes(t),
        ),
      );
      const countryComp = top?.address_components?.find((c) =>
        c.types?.includes('country'),
      );
      return {
        address: top?.formatted_address || fallback.address,
        city: cityComp?.long_name || '',
        country: countryComp?.short_name || null,
        lat,
        lng,
      };
    } catch {
      return fallback;
    }
  }, []);

  // Only allow points that lie inside India. The autocomplete already
  // applies `componentRestrictions: { country: 'in' }`, but we still
  // re-validate here so a buggy autocomplete result can't smuggle a
  // foreign coordinate into the booking draft.
  const ensureIndia = useCallback((point) => {
    if (!point) return false;
    if (!isInsideIndiaBounds(point.lat, point.lng)) return false;
    // If the geocoder couldn't resolve a country, trust the bounding
    // box — better than blocking a legitimate Indian pin because of a
    // transient OVER_QUERY_LIMIT.
    if (point.country && point.country !== 'IN') return false;
    return true;
  }, []);

  const rejectOutsideIndia = useCallback(() => {
    toast.error('Pickup and destination must be inside India.', {
      id: 'outstation-india-only',
    });
  }, []);

  useMapPlaceSearch(pickupInputRef, {
    maps,
    enabled: mapsReady,
    onSelect: ({ lat, lng, address, name }) => {
      const point = {
        address: address || name || '',
        city: '',
        country: null,
        lat,
        lng,
      };
      // We don't have a country code from the autocomplete payload
      // here, so we lean on the bounding-box check. The places API
      // call already filters by country, so this is just a belt.
      if (!ensureIndia(point)) {
        rejectOutsideIndia();
        return;
      }
      setLocalPickup(point);
      setActiveField('pickup');
    },
  });

  useMapPlaceSearch(destinationInputRef, {
    maps,
    enabled: mapsReady,
    onSelect: ({ lat, lng, address, name }) => {
      const point = {
        address: address || name || '',
        city: '',
        country: null,
        lat,
        lng,
      };
      if (!ensureIndia(point)) {
        rejectOutsideIndia();
        return;
      }
      setLocalDestination(point);
      setActiveField('drop');
    },
  });

  // Click on the map → drop a pin for whichever field is active and
  // reverse-geocode it so the input below shows the resolved address.
  const handleMapClick = useCallback(
    async (event) => {
      const lat = event?.latLng?.lat?.();
      const lng = event?.latLng?.lng?.();
      if (typeof lat !== 'number' || typeof lng !== 'number') return;
      // Fast path: reject obviously out-of-bounds taps without
      // burning a Geocoder request.
      if (!isInsideIndiaBounds(lat, lng)) {
        rejectOutsideIndia();
        return;
      }
      const point = await reverseGeocode({ lat, lng });
      if (!ensureIndia(point)) {
        rejectOutsideIndia();
        return;
      }
      if (activeField === 'drop') setLocalDestination(point);
      else setLocalPickup(point);
    },
    [activeField, reverseGeocode, ensureIndia, rejectOutsideIndia],
  );

  const handleMarkerDragEnd = useCallback(
    async (which, event) => {
      const lat = event?.latLng?.lat?.();
      const lng = event?.latLng?.lng?.();
      if (typeof lat !== 'number' || typeof lng !== 'number') return;
      if (!isInsideIndiaBounds(lat, lng)) {
        rejectOutsideIndia();
        // Snap the input field back to its previous coordinate by
        // forcing a re-render — React already re-renders when the
        // local state hasn't changed, but the marker has been
        // dragged via Google's gesture handling and is now visually
        // stale. Setting state to the same object reference would no-
        // op, so we set a structurally-equal new reference to
        // trigger a re-render and let `<MarkerF position>` snap the
        // pin back to the prop value.
        if (which === 'drop') {
          setLocalDestination((prev) => (prev ? { ...prev } : prev));
        } else {
          setLocalPickup((prev) => (prev ? { ...prev } : prev));
        }
        return;
      }
      const point = await reverseGeocode({ lat, lng });
      if (!ensureIndia(point)) {
        rejectOutsideIndia();
        if (which === 'drop') {
          setLocalDestination((prev) => (prev ? { ...prev } : prev));
        } else {
          setLocalPickup((prev) => (prev ? { ...prev } : prev));
        }
        return;
      }
      if (which === 'drop') setLocalDestination(point);
      else setLocalPickup(point);
    },
    [reverseGeocode, ensureIndia, rejectOutsideIndia],
  );

  // Centre the embedded map on whichever marker exists; fall back to
  // pickup, then destination, then the country default.
  const mapCenter = useMemo(() => {
    if (localPickup?.lat && localPickup?.lng) {
      return { lat: localPickup.lat, lng: localPickup.lng };
    }
    if (localDestination?.lat && localDestination?.lng) {
      return { lat: localDestination.lat, lng: localDestination.lng };
    }
    return DEFAULT_MAP_CENTER;
  }, [localPickup, localDestination]);

  const mapZoom = localPickup?.lat || localDestination?.lat ? 13 : 11;

  // Hard-restrict the map's pan range to India. `strictBounds: true`
  // prevents the user from scrolling beyond the country at all, so
  // they can't even *see* a foreign location to try tapping it.
  // Memoised so `MapView`'s options-merge stays stable.
  const mapOptions = useMemo(
    () => ({
      restriction: {
        latLngBounds: INDIA_MAP_BOUNDS,
        strictBounds: true,
      },
      minZoom: 4,
    }),
    [],
  );

  /* ------------------------------------------------------------------ */
  /* Route polyline                                                       */
  /* ------------------------------------------------------------------ */

  // Stable LatLng objects so `useDirectionsRoute`'s identity comparison
  // doesn't fire a fresh request every render. Only emit when both
  // endpoints are real coordinates. We depend on the whole local
  // state object — re-running the memo on an address-only change is
  // cheap and the resulting LatLng is value-equal anyway, so the
  // hook's internal sameLatLng check skips redundant API calls.
  const routeOrigin = useMemo(() => {
    if (!localPickup?.lat || !localPickup?.lng) return null;
    return { lat: localPickup.lat, lng: localPickup.lng };
  }, [localPickup]);

  const routeDestination = useMemo(() => {
    if (!localDestination?.lat || !localDestination?.lng) return null;
    return { lat: localDestination.lat, lng: localDestination.lng };
  }, [localDestination]);

  const route = useDirectionsRoute({
    maps,
    origin: routeOrigin,
    destination: routeDestination,
    enabled: mapsReady && !!routeOrigin && !!routeDestination,
  });

  /* ------------------------------------------------------------------ */
  /* Service-zone check                                                  */
  /* ------------------------------------------------------------------ */

  // Pickup must lie inside one of the active service zones our ops team
  // has carved out — otherwise we can't dispatch a driver. We only
  // gate the *pickup* (the destination can be anywhere in India for an
  // outstation trip; that's the whole point). The hook debounces and
  // dedupes requests, so it's safe to feed every map-tap update in.
  const zoneCheck = useZoneCheck(routeOrigin, {
    enabled: !!routeOrigin,
  });
  const pickupZoneStatus = zoneCheck.status;
  const pickupOutOfZone = pickupZoneStatus === 'uncovered';
  const pickupZoneName = zoneCheck.zone?.name || null;
  const pickupZoneCity = zoneCheck.zone?.city || '';

  // We want the dialog to *auto-dismiss* the moment the user fixes
  // the pickup (e.g. by typing a new address into the search box
  // behind the modal backdrop on tablet). Putting the auto-dismiss
  // in an effect would trigger `react-hooks/set-state-in-effect`, so
  // we instead store the user's *intent* to open and AND it with the
  // live status to derive visibility.
  const [outOfServiceRequested, setOutOfServiceRequested] = useState(false);
  const outOfServiceOpen = outOfServiceRequested && pickupOutOfZone;

  // Frame both endpoints once the route resolves (or whenever either
  // endpoint changes). We use the imperative `fitBounds` exposed by
  // `<MapView>`'s ref so the GoogleMap stays uncontrolled — controlling
  // `center`/`zoom` would fight the user's pan/zoom gestures.
  const mapRef = useRef(null);

  useEffect(() => {
    if (!mapsReady || !mapRef.current || !maps) return;
    if (!routeOrigin || !routeDestination) return;
    const bounds = new maps.LatLngBounds();
    bounds.extend(routeOrigin);
    bounds.extend(routeDestination);
    // Padding gives the markers a little breathing room from the edge
    // and keeps the polyline clear of the floating "Tap to set" chip.
    mapRef.current.fitBounds(bounds, {
      top: 48,
      right: 32,
      bottom: 32,
      left: 32,
    });
  }, [mapsReady, maps, routeOrigin, routeDestination]);

  // Convenience figures for the inline route summary chip.
  const routeKm = Number.isFinite(route?.distanceMeters)
    ? Math.max(1, Math.round(route.distanceMeters / 1000))
    : null;
  const routeMin = Number.isFinite(route?.durationSeconds)
    ? Math.max(1, Math.round(route.durationSeconds / 60))
    : null;

  /* ------------------------------------------------------------------ */
  /* Cars                                                                 */
  /* ------------------------------------------------------------------ */

  const [cars, setCars] = useState([]);
  const [carsLoading, setCarsLoading] = useState(true);
  const [addCarOpen, setAddCarOpen] = useState(false);

  // Single fetch on mount. `carsLoading` defaults to `true` from
  // `useState`, so we don't need a synchronous setState here (which
  // would trigger the `react-hooks/set-state-in-effect` lint).
  useEffect(() => {
    let cancelled = false;
    api
      .get('/auth/cars')
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res?.data?.data) ? res.data.data : [];
        setCars(list);
        if (!draftCarId && list.length > 0) setCarIdStore(list[0]._id);
      })
      .catch(() => {
        if (!cancelled) setCars([]);
      })
      .finally(() => {
        if (!cancelled) setCarsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mirrors `CarPickerSheet.handleCarAdded` — splice the new vehicle
  // into the local list (without re-fetching) and auto-select it so
  // the user lands on the freshly-added car. If the form's success
  // payload didn't carry the car (older API versions), fall back to a
  // full refetch.
  const handleCarAdded = useCallback(
    ({ car } = {}) => {
      if (car?._id) {
        setCars((prev) => {
          const exists = prev.some((c) => c._id === car._id);
          return exists ? prev : [car, ...prev];
        });
        setCarIdStore(car._id);
        return;
      }
      // Refetch fallback.
      api
        .get('/auth/cars')
        .then((res) => {
          const list = Array.isArray(res?.data?.data) ? res.data.data : [];
          setCars(list);
          if (list[0]?._id) setCarIdStore(list[0]._id);
        })
        .catch(() => {});
    },
    [setCarIdStore],
  );

  const carsAtLimit = cars.length >= MAX_USER_CARS;

  /* ------------------------------------------------------------------ */
  /* Continue                                                             */
  /* ------------------------------------------------------------------ */

  const canContinue =
    !!localPickup?.lat &&
    !!localPickup?.address &&
    !!localDestination?.lat &&
    !!localDestination?.address &&
    !!pickupAt &&
    !!expectedReturnAt &&
    days >= 1 &&
    (cars.length === 0 || !!draftCarId);

  const handleContinue = () => {
    if (!canContinue) return;
    // Defer the zone verdict to this exact moment — the inline strip
    // already nudges the user, but we still hard-block at click time
    // to cover the "first-load, hook still resolving" race. We don't
    // block on `'checking'` — letting the user proceed slightly
    // optimistically is fine because the next screen re-runs an
    // estimate that the backend can also reject if needed.
    if (pickupOutOfZone) {
      setOutOfServiceRequested(true);
      return;
    }
    setPickupStore(localPickup);
    // setDropoff also mirrors the address into outstation.destinationAddress.
    setDropoffStore(localDestination);
    const pickupIso = new Date(pickupAt).toISOString();
    const returnIso = new Date(expectedReturnAt).toISOString();
    onPatch({
      pickupAt: pickupIso,
      expectedReturnAt: returnIso,
      // Mirror into the legacy date pair so older readers keep working.
      startDate: pickupIso,
      endDate: returnIso,
      days,
      nights,
    });
    onContinue();
  };

  /**
   * Wired to the OutOfServiceDialog's "Change pickup location" CTA.
   * We don't have a separate picker sheet on this page — the search
   * input is already on screen — so we just focus + scroll the
   * pickup field and arm the "tap map for pickup" mode so the next
   * map tap also lands on it.
   */
  const handleChangePickup = () => {
    setActiveField('pickup');
    if (pickupInputRef.current) {
      try {
        pickupInputRef.current.focus({ preventScroll: false });
      } catch {
        pickupInputRef.current.focus();
      }
      pickupInputRef.current.scrollIntoView?.({
        behavior: 'smooth',
        block: 'center',
      });
    }
  };

  return (
    <PageShell
      title="Plan your round trip"
      subtitle="Pickup and return are the same place — we drop you back home."
      onBack={() => navigate(-1)}
      footer={(
        <Footer
          priceHint={
            dailyRate > 0
              ? `₹${dailyRate}/day${
                  allowancePerNight > 0
                    ? ` · ₹${allowancePerNight}/night allowance`
                    : ''
                }`
              : 'Set on next screen'
          }
          priceLabel={`${days} day${days === 1 ? '' : 's'}`}
          primaryLabel="Continue"
          disabled={!canContinue}
          onClick={handleContinue}
        />
      )}
    >
      {/* Round-trip explainer. Uses sky tones rather than the brand
          primary because primary-on-white reads as washed-out
          orange and the user flagged it as unreadable. */}
      <div className="rounded-2xl bg-sky-50 border border-sky-100 px-3 py-2 flex items-start gap-2">
        <RefreshCw className="w-4 h-4 text-sky-700 mt-0.5 shrink-0" />
        <p className="text-[12px] leading-snug text-sky-900">
          <strong className="font-semibold">Round trip:</strong> your
          driver stays with you the whole trip and drops you back at the
          pickup on day {days}.
        </p>
      </div>

      {/* Pickup + destination — return is implicit (= pickup). The
          embedded map lets the customer drop pins by tapping; pin
          drag updates the address via reverse-geocoding. */}
      <Card>
        <h3 className="text-base font-bold text-slate-900 mb-3">
          Pickup &amp; destination
        </h3>
        <div className="space-y-2">
          <LocationField
            tone="green"
            icon={MapPin}
            label="Pickup"
            placeholder="Search pickup location"
            inputRef={pickupInputRef}
            value={localPickup?.address || ''}
            active={activeField === 'pickup'}
            onFocus={() => setActiveField('pickup')}
            onChange={(v) =>
              setLocalPickup((p) => ({
                ...(p || { lat: null, lng: null, city: '' }),
                address: v,
              }))
            }
          />
          <LocationField
            tone="red"
            icon={Navigation}
            label="Destination"
            placeholder="Where are you going?"
            inputRef={destinationInputRef}
            value={localDestination?.address || ''}
            active={activeField === 'drop'}
            onFocus={() => setActiveField('drop')}
            onChange={(v) =>
              setLocalDestination((p) => ({
                ...(p || { lat: null, lng: null, city: '' }),
                address: v,
              }))
            }
          />
        </div>

        {/* Inline service-zone verdict for the pickup. We surface the
            uncovered case prominently so the user can change pickup
            without first hitting Continue and getting blocked by the
            modal. The covered/checking states are kept low-noise. */}
        <ZoneStatusStrip
          status={pickupZoneStatus}
          zoneName={pickupZoneName}
          city={pickupZoneCity}
          onChangePickup={handleChangePickup}
        />

        {/* Field-toggle chips so the user can pick which marker the
            next map tap controls without depending on input focus. */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <FieldChip
            active={activeField === 'pickup'}
            tone="green"
            label="Tap map for pickup"
            onClick={() => setActiveField('pickup')}
          />
          <FieldChip
            active={activeField === 'drop'}
            tone="red"
            label="Tap map for destination"
            onClick={() => setActiveField('drop')}
          />
        </div>

        <div className="mt-3 relative">
          <MapView
            ref={mapRef}
            height={220}
            center={mapCenter}
            zoom={mapZoom}
            options={mapOptions}
            onClick={handleMapClick}
          >
            {/* Road-following polyline between pickup and destination.
                `RoutePolyline` is the same component the live-trip map
                uses, so the customer sees a familiar Uber/Rapido
                halo+stroke. Falls back to `null` while Directions
                resolves (or if the API errors out). */}
            {route?.path && route.path.length > 1 && (
              <RoutePolyline path={route.path} animate animationMs={650} />
            )}
            {localPickup?.lat && localPickup?.lng && mapsReady && (
              <PinMarker
                position={{ lat: localPickup.lat, lng: localPickup.lng }}
                color="#10B981"
                label="Pickup · Return"
                onDragEnd={(e) => handleMarkerDragEnd('pickup', e)}
              />
            )}
            {localDestination?.lat && localDestination?.lng && mapsReady && (
              <PinMarker
                position={{
                  lat: localDestination.lat,
                  lng: localDestination.lng,
                }}
                color="#EF4444"
                label="Destination"
                onDragEnd={(e) => handleMarkerDragEnd('drop', e)}
              />
            )}
          </MapView>

          {/* Top-left: which field a tap will populate. */}
          <div className="absolute top-2 left-2 right-2 pointer-events-none flex items-start justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-lg bg-white/95 shadow px-2.5 py-1 text-[11px] font-semibold text-slate-700">
              <Pointer className="w-3 h-3" />
              Tap to set
              <span
                className={
                  activeField === 'drop'
                    ? 'text-red-600'
                    : 'text-emerald-600'
                }
              >
                {activeField === 'drop' ? 'Destination' : 'Pickup'}
              </span>
            </div>

            {/* Top-right: route distance + ETA chip — surfaces the
                Directions answer so the customer can sanity-check the
                trip length before committing. */}
            {routeOrigin && routeDestination && (
              <div className="inline-flex items-center gap-1.5 rounded-lg bg-white/95 shadow px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                <Navigation className="w-3 h-3 text-sky-600" />
                {route?.status === 'ok' && routeKm != null ? (
                  <>
                    <span className="text-slate-900">{routeKm} km</span>
                    {routeMin != null && (
                      <span className="text-text-muted">· {routeMin} min</span>
                    )}
                  </>
                ) : route?.status === 'idle' || !route?.status ? (
                  <span className="text-text-muted">Routing…</span>
                ) : (
                  <span className="text-text-muted">Route unavailable</span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 space-y-2">
          <div className="rounded-xl bg-bg px-3 py-2 flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 text-text-muted shrink-0" />
            <span className="text-[11px] text-text-muted">
              Pickup is also your return — the driver drops you back here.
            </span>
          </div>
          <div className="rounded-xl bg-bg px-3 py-2 flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-text-muted shrink-0" />
            <span className="text-[11px] text-text-muted">
              We currently operate inside India only — locations
              outside India can&rsquo;t be selected.
            </span>
          </div>
        </div>
      </Card>

      {/* Pickup + return time. */}
      <Card>
        <h3 className="text-base font-bold text-slate-900 mb-3">When?</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-2">
              Pickup time
            </label>
            <input
              type="datetime-local"
              value={pickupAt}
              min={defaultPickupInputValue()}
              onChange={(e) => onPickupTimeChange(e.target.value)}
              className="w-full h-11 bg-gray-50 border border-border rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-2">
              Expected return
            </label>
            <input
              type="datetime-local"
              value={expectedReturnAt}
              min={pickupAt}
              onChange={(e) => setExpectedReturnAt(e.target.value)}
              className="w-full h-11 bg-gray-50 border border-border rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between bg-bg rounded-xl px-3 py-2">
          <span className="text-xs text-text-muted inline-flex items-center gap-1.5">
            <CalendarRange className="w-3.5 h-3.5" />
            Trip length
          </span>
          <span className="text-sm font-bold text-text">
            {days} day{days > 1 ? 's' : ''} · {nights} night
            {nights === 1 ? '' : 's'}
          </span>
        </div>
      </Card>

      {/* Car selection. The "Add car" CTA opens an in-place modal
          (same `<AddCarModal>` the hourly trip-details flow uses) so
          the user never loses their booking draft. We disable the
          tile once the user owns `MAX_USER_CARS` vehicles. */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-slate-900">
            Choose your car
          </h3>
          {cars.length > 0 && (
            <button
              type="button"
              onClick={() => navigate('/user/my-cars')}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Manage
            </button>
          )}
        </div>
        <CarStrip
          cars={cars}
          loading={carsLoading}
          selectedId={draftCarId}
          onSelect={setCarIdStore}
          onAdd={() => setAddCarOpen(true)}
          addDisabled={carsAtLimit}
          maxCars={MAX_USER_CARS}
        />
      </Card>

      <p className="text-[11px] text-text-muted text-center">
        Fare with food &amp; stay options is shown on the next screen.
      </p>

      {/* In-place add-car popup. Reuses the exact component the
          hourly flow uses (`AddCarModal` ➜ `AddCarForm`) so we share
          all validation, image upload + RC scan logic. */}
      <AddCarModal
        open={addCarOpen}
        onClose={() => setAddCarOpen(false)}
        onCarAdded={handleCarAdded}
      />

      {/* "We don't operate here yet" dialog. Same dialog the hourly
          flow uses — the parent owns visibility and the change-pickup
          handler. */}
      <OutOfServiceDialog
        open={outOfServiceOpen}
        onClose={() => setOutOfServiceRequested(false)}
        onChangeLocation={handleChangePickup}
        locationLabel={localPickup?.address || ''}
        cityHint={localPickup?.city || ''}
      />
    </PageShell>
  );
}

/**
 * Inline pickup-zone verdict pill. Renders only when the user has
 * a pickup coordinate that we've evaluated. Keeps the covered /
 * checking states quiet (a single line) and the uncovered state
 * loud (rose card with a "change pickup" CTA) so the user notices
 * the issue before they fill out the rest of the form.
 */
function ZoneStatusStrip({ status, zoneName, city, onChangePickup }) {
  if (status === 'idle' || status === 'error') return null;

  if (status === 'checking') {
    return (
      <div className="mt-2 rounded-xl bg-bg px-3 py-2 flex items-center gap-2">
        <Loader2 className="w-3.5 h-3.5 text-text-muted shrink-0 animate-spin" />
        <span className="text-[11px] text-text-muted">
          Checking if we operate at your pickup…
        </span>
      </div>
    );
  }

  if (status === 'covered') {
    return (
      <div className="mt-2 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2 flex items-center gap-2">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <span className="text-[11px] text-emerald-900">
          We operate at this pickup
          {zoneName ? <> · <span className="font-semibold">{zoneName}</span></> : null}
        </span>
      </div>
    );
  }

  // uncovered
  return (
    <div className="mt-2 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 flex items-start gap-2">
      <MapPinOff className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold text-rose-900">
          {city ? `We're not live in ${city} yet` : 'Pickup is outside our service area'}
        </p>
        <p className="text-[11px] text-rose-800/90 mt-0.5">
          Pick a pickup inside one of our serviced areas to continue.
        </p>
      </div>
      <button
        type="button"
        onClick={onChangePickup}
        className="shrink-0 text-[11px] font-semibold text-rose-700 hover:text-rose-900 underline"
      >
        Change
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Outstation sub-components                                           */
/* ------------------------------------------------------------------ */

function LocationField({
  tone,
  icon: Icon,
  label,
  placeholder,
  inputRef,
  value,
  active,
  onChange,
  onFocus,
}) {
  const toneClasses = tone === 'red'
    ? 'bg-red-50 text-red-600'
    : 'bg-emerald-50 text-emerald-600';
  // The "active" state is a soft ring — it tells the user that the
  // next map tap will land on this field's marker without stealing
  // focus from whatever the user might be typing.
  const ringClass = active
    ? tone === 'red'
      ? 'ring-2 ring-red-300/70'
      : 'ring-2 ring-emerald-300/70'
    : '';
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border border-border bg-gray-50 px-3 py-2 ${ringClass}`}
    >
      <span
        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${toneClasses}`}
      >
        <Icon className="w-4 h-4" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-text-muted">
          {label}
        </p>
        <input
          ref={inputRef}
          type="search"
          value={value}
          placeholder={placeholder}
          onFocus={onFocus}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent border-0 p-0 text-sm font-medium text-text placeholder:text-text-muted focus:outline-none truncate"
          autoComplete="off"
        />
      </div>
    </div>
  );
}

function FieldChip({ active, tone, label, onClick }) {
  const activeClasses =
    tone === 'red'
      ? 'bg-red-50 text-red-700 border-red-200'
      : 'bg-emerald-50 text-emerald-700 border-emerald-200';
  const idleClasses = 'bg-white text-text-muted border-border';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-semibold transition ${
        active ? activeClasses : idleClasses
      }`}
    >
      <Crosshair className="w-3 h-3" />
      {label}
    </button>
  );
}

/**
 * Draggable colored pin used on the embedded outstation map. We use
 * Google's stock dot icons (CDN-served PNGs) instead of an SVG path
 * so we don't have to instantiate `google.maps.Point` for the anchor
 * — the dot has its hotspot already centred at the bottom of the pin.
 */
const PIN_ICON_URLS = {
  green: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
  red: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
};

function PinMarker({ position, color, label, onDragEnd }) {
  const iconUrl = color === '#EF4444' ? PIN_ICON_URLS.red : PIN_ICON_URLS.green;
  return (
    <MarkerF
      position={position}
      draggable
      onDragEnd={onDragEnd}
      icon={iconUrl}
      title={label}
    />
  );
}

function CarStrip({
  cars,
  loading,
  selectedId,
  onSelect,
  onAdd,
  addDisabled = false,
  maxCars,
}) {
  if (loading) {
    return (
      <div className="h-24 flex items-center justify-center text-text-muted">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }
  // Empty state — when the customer hasn't registered any vehicle
  // yet. The CTA is the same dashed card; if they're somehow already
  // at the cap (impossible in practice but harmless to handle) we
  // present the locked variant instead.
  if (cars.length === 0) {
    return (
      <button
        type="button"
        onClick={addDisabled ? undefined : onAdd}
        disabled={addDisabled}
        aria-disabled={addDisabled}
        className={`w-full border-2 border-dashed rounded-2xl p-4 flex items-center gap-3 text-left transition ${
          addDisabled
            ? 'border-border bg-gray-50 cursor-not-allowed opacity-70'
            : 'border-border hover:bg-gray-50 active:scale-[0.99]'
        }`}
      >
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            addDisabled ? 'bg-gray-200 text-text-muted' : 'bg-gray-100'
          }`}
        >
          {addDisabled ? (
            <Lock className="w-4 h-4" />
          ) : (
            <Plus className="w-5 h-5 text-text-muted" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text">
            {addDisabled
              ? `You've reached the ${maxCars}-car limit`
              : 'Add a vehicle'}
          </p>
          <p className="text-xs text-text-muted">
            {addDisabled
              ? 'Remove a car from "My cars" to register a new vehicle.'
              : 'You need at least one car to book a driver.'}
          </p>
        </div>
      </button>
    );
  }
  return (
    <div className="-mx-4 px-4 overflow-x-auto">
      <div className="flex gap-3 pb-1">
        {cars.map((car) => {
          const isSelected = car._id === selectedId;
          return (
            <button
              key={car._id}
              type="button"
              onClick={() => onSelect(car._id)}
              className={`shrink-0 w-32 rounded-2xl border-2 p-2.5 text-left transition relative ${
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-white hover:border-text-muted/40'
              }`}
            >
              <div className="w-full h-14 rounded-xl bg-gray-100 overflow-hidden flex items-center justify-center mb-2">
                {car.image ? (
                  <img src={car.image} alt="" className="w-full h-full object-cover" />
                ) : (
                  <CarIcon className="w-6 h-6 text-text-muted" />
                )}
              </div>
              <p className="text-xs font-bold text-text truncate">{getCarBrandName(car)}</p>
              <p className="text-[10px] text-text-muted truncate">{getCarModelName(car)}</p>
              <p className="mt-1 text-[10px] font-mono font-bold text-text-secondary truncate">
                {car.vehicleNumber}
              </p>
              {isSelected && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center shadow">
                  <Check className="w-3 h-3" />
                </span>
              )}
            </button>
          );
        })}
        {/* Trailing "+ Add" tile in the strip. Mirrors the locked-tile
            pattern from `CarPickerSheet` so the experience is the
            same wherever the customer adds a vehicle. */}
        <button
          type="button"
          onClick={addDisabled ? undefined : onAdd}
          disabled={addDisabled}
          aria-disabled={addDisabled}
          title={
            addDisabled
              ? `You've reached the ${maxCars}-car limit. Remove a car from "My cars" to add another.`
              : undefined
          }
          className={`shrink-0 w-32 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition ${
            addDisabled
              ? 'border-border bg-gray-50 text-text-muted cursor-not-allowed opacity-70'
              : 'border-border text-text-muted hover:text-text hover:border-text-muted/60'
          }`}
        >
          {addDisabled ? <Lock className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          <span className="text-[11px] font-semibold text-center px-1 leading-tight">
            {addDisabled ? `${maxCars}-car limit` : 'Add car'}
          </span>
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

function PageShell({ title, subtitle, onBack, children, footer }) {
  // Header and footer use `position: sticky` so they remain pinned to
  // the top / bottom of the viewport while the middle content scrolls.
  // `min-h-dvh` keeps the page tall enough on short content; sticky
  // works regardless of the document/viewport scroll context.
  return (
    <div className="flex-1 flex flex-col bg-bg min-h-dvh">
      <div className="sticky top-0 z-30 bg-white px-4 pt-4 pb-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 -ml-2 rounded-xl hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5 text-text" />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-text truncate">{title}</h1>
            <p className="text-xs text-text-muted truncate">{subtitle}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-4">{children}</div>

      {footer}
    </div>
  );
}

function Footer({ priceHint, priceLabel, primaryLabel, disabled, onClick }) {
  return (
    <div className="sticky bottom-0 z-30 p-4 bg-white border-t border-border-light shadow-[0_-4px_12px_-8px_rgba(0,0,0,0.15)]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-text-muted">{priceHint}</span>
        <span className="text-lg font-bold text-text">{priceLabel}</span>
      </div>
      <Button fullWidth disabled={disabled} onClick={onClick}>
        {primaryLabel}
      </Button>
    </div>
  );
}

function RadioDot({ active }) {
  return (
    <div
      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
        active ? 'border-primary bg-primary' : 'border-gray-300'
      }`}
    >
      {active && <Check className="w-3 h-3 text-white" />}
    </div>
  );
}

/**
 * Bounding-box check against `INDIA_MAP_BOUNDS`. The box is generous
 * (it includes parts of Pakistan, China, Bangladesh, Bhutan, Nepal,
 * Myanmar) so we still rely on the geocoder's country code as the
 * authoritative validator. This helper is the cheap first pass.
 */
function isInsideIndiaBounds(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  return (
    lat >= INDIA_MAP_BOUNDS.south &&
    lat <= INDIA_MAP_BOUNDS.north &&
    lng >= INDIA_MAP_BOUNDS.west &&
    lng <= INDIA_MAP_BOUNDS.east
  );
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function defaultIsoForInput() {
  const d = new Date(Date.now() + 30 * 60 * 1000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default SelectVariantPage;
