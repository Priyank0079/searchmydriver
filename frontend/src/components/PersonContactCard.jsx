import { Phone, MessageSquare, Star } from 'lucide-react';
import Card from './Card';
import Avatar from './Avatar';
import Button from './Button';

/**
 * Single source of truth for the "person you're connected with on this
 * trip" card.
 *
 *   user side  → renders the assigned DRIVER (rating, experience, vehicle
 *                expertise, Call + Message buttons).
 *   driver side → renders the CUSTOMER (compact: avatar + name + phone + a
 *                 single call-icon button on the right).
 *
 * The layout switches automatically based on whether any of the "rich"
 * details (rating / experience / expertise) are present. Both pages
 * therefore consume the same component and the styling stays in lockstep.
 *
 * Props:
 *   - src               profile picture URL (falls back to initials)
 *   - name              display name
 *   - online            green dot under the avatar (live presence)
 *   - roleLabel         tiny header e.g. "Customer" / "Driver"
 *   - rating            number (driver only)
 *   - experienceYears   number (driver only)
 *   - expertise         string[] e.g. ['Honda City', 'Suzuki Swift']
 *   - metaLine          short text under the name (e.g. distance or phone)
 *   - phone             international-friendly phone (digits + chars)
 *   - showMessageButton add a Message CTA next to Call (driver card only)
 *   - phoneCallLabel    aria-label on the call icon (compact layout)
 */
const PersonContactCard = ({
  src,
  name,
  online,
  roleLabel,
  rating,
  experienceYears,
  expertise = [],
  metaLine,
  phone,
  showMessageButton = false,
  phoneCallLabel = 'Call',
}) => {
  const callHref = phone
    ? `tel:+91${String(phone).replace(/\D/g, '')}`
    : null;
  const hasRichDetails =
    !!rating || !!experienceYears || (expertise && expertise.length > 0);

  if (!hasRichDetails) {
    return (
      <Card>
        <div className="flex items-start gap-3">
          <Avatar
            src={src || null}
            name={name || roleLabel || 'Contact'}
            size="lg"
            online={online}
          />
          <div className="flex-1 min-w-0">
            {roleLabel && (
              <p className="text-[11px] text-text-muted">{roleLabel}</p>
            )}
            <p className="text-sm font-bold text-text truncate">
              {name || roleLabel || 'Contact'}
            </p>
            {metaLine && (
              <p className="text-[11px] text-text-muted font-mono mt-0.5">
                {metaLine}
              </p>
            )}
          </div>
          {phone && (
            <a
              href={callHref}
              className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center hover:bg-emerald-100 shrink-0"
              aria-label={phoneCallLabel}
            >
              <Phone className="w-4 h-4" />
            </a>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-start gap-4">
        <Avatar
          src={src || null}
          name={name || roleLabel || 'Contact'}
          size="xl"
          online={online}
        />
        <div className="flex-1 min-w-0">
          {roleLabel && (
            <p className="text-[11px] text-text-muted">{roleLabel}</p>
          )}
          <h3 className="text-lg font-bold text-text truncate">
            {name || roleLabel || 'Contact'}
          </h3>
          {(rating || experienceYears) && (
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {rating ? (
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-text">
                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  {Number(rating).toFixed(1)}
                </span>
              ) : null}
              {experienceYears ? (
                <>
                  {rating ? (
                    <span className="text-text-muted text-xs">{'\u00B7'}</span>
                  ) : null}
                  <span className="text-xs text-text-secondary">
                    {Math.round(experienceYears)}+ yrs experience
                  </span>
                </>
              ) : null}
            </div>
          )}
          {metaLine && (
            <p className="text-xs text-text-muted mt-1">{metaLine}</p>
          )}
          {expertise.length > 0 && (
            <p className="text-[11px] text-text-muted mt-1 truncate">
              Drives: {expertise.join(', ')}
            </p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mt-4">
        <Button
          variant="secondary"
          size="md"
          icon={Phone}
          disabled={!phone}
          onClick={() => {
            if (callHref) window.location.href = callHref;
          }}
        >
          Call
        </Button>
        {showMessageButton && (
          <Button variant="secondary" size="md" icon={MessageSquare}>
            Message
          </Button>
        )}
      </div>
    </Card>
  );
};

export default PersonContactCard;
