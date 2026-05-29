import { memo } from 'react';
import { OverlayViewF, OverlayView } from '@react-google-maps/api';
import { PIN_ASSETS, MAP_Z_INDEX } from '../../constants/mapTheme';

/**
 * <UserMarker /> — non-animated pin for static endpoints (pickup, drop,
 * "you are here"). Visually paired with `<DriverMarker />` on every live-
 * trip map: the driver glides, the endpoints stay put.
 *
 * Implemented as an HTML overlay (rather than a `<MarkerF>`) so:
 *   1. We get pixel-perfect anchoring for the bottom-tip of the asset —
 *      Google's default Marker anchor sits in the middle, which makes
 *      pickup pins float above the actual coordinate. The overlay offset
 *      below pins the tip exactly on the lat/lng.
 *   2. We can drop in an entry "bounce" without juggling SVG transforms.
 *   3. The asset stays crisp on Retina screens (Google's marker icons
 *      down-sample raster icons aggressively).
 *
 * Variants:
 *   - `kind="pickup"` → green location pin (default)
 *   - `kind="drop"`   → red destination pin
 *   - `kind="user"`   → "your current location" pin
 *
 * The visual is purely driven by `imageSrc` so callers can swap the
 * artwork without forking the component.
 */

const KIND_TO_ASSET = {
  pickup: PIN_ASSETS.PICKUP,
  drop: PIN_ASSETS.PICKUP,
  user: PIN_ASSETS.CURRENT_LOCATION,
  current: PIN_ASSETS.CURRENT_LOCATION,
  driver: PIN_ASSETS.DRIVER,
};

const KIND_TO_LABEL = {
  pickup: 'Pickup',
  drop: 'Drop',
  user: 'You',
  current: 'You',
  driver: 'Driver',
};

// Anchor at bottom-centre — pin "tip" sits on the requested coordinate.
const getPixelPositionOffset = (width, height) => ({
  x: -width / 2,
  y: -height + 4,
});

function UserMarker({
  position,
  kind = 'pickup',
  imageSrc,
  size = 44,
  label,
  bounce = false,
  zIndex = MAP_Z_INDEX.USER_MARKER,
  ariaLabel,
}) {
  if (!position) return null;
  const src = imageSrc || KIND_TO_ASSET[kind] || PIN_ASSETS.PICKUP;
  const aria = ariaLabel || label || KIND_TO_LABEL[kind] || 'Marker';

  return (
    <OverlayViewF
      position={position}
      // MARKER_LAYER sits *above* OVERLAY_LAYER (where PolylineF lives), so
      // pins always render on top of the route line. Using OVERLAY_LAYER here
      // (the previous default) caused the polyline to draw on top of the
      // pickup/drop images.
      mapPaneName={OverlayView.MARKER_LAYER}
      getPixelPositionOffset={getPixelPositionOffset}
      zIndex={zIndex}
    >
      <div
        style={{
          width: size,
          height: Math.round(size * 1.25),
          pointerEvents: 'none',
          // Subtle entry animation — disabled by default to avoid distracting
          // motion on every render; opt-in via `bounce={true}`.
          animation: bounce ? 'gmap-pin-drop 280ms cubic-bezier(.2,.7,.3,1.2)' : 'none',
        }}
        aria-label={aria}
      >
        <img
          src={src}
          alt={aria}
          draggable={false}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            filter: 'drop-shadow(0 4px 6px rgba(15, 23, 42, 0.22))',
          }}
        />
        <style>{`
          @keyframes gmap-pin-drop {
            0%   { transform: translateY(-12px); opacity: 0; }
            100% { transform: translateY(0);     opacity: 1; }
          }
        `}</style>
      </div>
    </OverlayViewF>
  );
}

export default memo(UserMarker);
