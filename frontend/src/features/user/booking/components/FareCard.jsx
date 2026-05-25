import { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import Card from '../../../../components/Card';

/**
 * Renders the line-by-line fare breakdown returned by `/auth/bookings/estimate`.
 *
 * The pricing-engine field names and the UI labels live here — every page
 * that needs to show a fare should consume this component instead of
 * rolling its own table. Zero-valued rows are filtered out for a clean look.
 *
 *   props:
 *     - estimate       full /estimate response (we read `estimate.fareBreakdown`)
 *     - estimating     boolean → shows a spinner next to the title
 *     - error          string → renders the error banner
 *     - dense          boolean → tighter spacing (used inline on slab page)
 *     - footnote       optional string under the total (e.g. "incl. food")
 */
const ROW_ORDER = [
  ['Base fare', (bd) => bd.packagePrice ?? bd.dailyRateTotal ?? 0],
  ['Extra hours', (bd) => bd.extraHourCharge],
  ['Waiting', (bd) => bd.waitingCharge],
  ['Night charge', (bd) => bd.nightCharge],
  ['Stay charges', (bd) => bd.stayChargeTotal ?? bd.nightHaltTotal],
  ['Food allowance', (bd) => bd.foodAllowance ?? bd.foodAllowanceTotal],
  ['Extra km', (bd) => bd.extraKmCharge],
  ['Toll & parking', (bd) => bd.tollParking],
  ['Service charge', (bd) => bd.serviceCharge],
  ['GST', (bd) => bd.gstAmount],
  [
    'Subscription discount',
    (bd) => (bd.subscriptionDiscount ? -Math.abs(bd.subscriptionDiscount) : 0),
  ],
];

const FareCard = ({ estimate, estimating = false, error = null, dense = false, footnote = null, title = 'Fare estimate' }) => {
  const breakdown = estimate?.fareBreakdown || {};
  const rows = useMemo(
    () =>
      ROW_ORDER.map(([label, picker]) => [label, picker(breakdown)]).filter(
        ([, v]) => Number(v || 0) !== 0,
      ),
    [breakdown],
  );
  const total = breakdown.totalPayable || 0;

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text">{title}</h3>
        {estimating && <Loader2 className="w-4 h-4 animate-spin text-text-muted" />}
      </div>

      {error && (
        <div className="text-xs text-danger bg-danger/10 rounded-xl px-3 py-2">{error}</div>
      )}

      {!error && (
        <div className={dense ? 'space-y-1.5' : 'space-y-2.5'}>
          {rows.map(([label, amount]) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">{label}</span>
              <span className={`text-sm ${amount < 0 ? 'text-success' : 'text-text'}`}>
                {amount < 0 ? '-' : ''}₹{Math.abs(Number(amount || 0))}
              </span>
            </div>
          ))}
          <div className="h-px bg-border-light my-1" />
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-text">Total</span>
            <span className="text-lg font-bold text-text">₹{total}</span>
          </div>
          {footnote && <p className="text-[11px] text-text-muted">{footnote}</p>}
        </div>
      )}
    </Card>
  );
};

export default FareCard;
