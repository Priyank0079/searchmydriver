/**
 * Reusable layout for driver bottom-nav screens.
 *
 *   ┌─────────────────────────┐
 *   │  header (sticky)         │  <- doesn't scroll, full-width brand band
 *   ├─────────────────────────┤
 *   │  body (overflow-y-auto)  │  <- scrolls within the viewport
 *   └─────────────────────────┘
 *
 * The bottom navigation is fixed at the bottom of the viewport (rendered by
 * `DashboardLayout`), so the shell sizes itself to
 *   100dvh − 4rem (the bottom-nav height)
 * which means the scrollable body never disappears under the nav and the
 * header always stays parked at the top — even on small phones where the
 * URL bar collapses mid-scroll.
 *
 * Why a dedicated component instead of inline classes on each page?
 *   - Three driver tabs (Trips, Earnings, Account) want the same visual:
 *     dark rounded header band + body. Inlining the math would let them
 *     drift over time and looks ad-hoc.
 *   - Sticky scroll inside a flex column needs an explicit min-height: 0
 *     on the scroller, which is a footgun that's easy to forget.
 *
 * The header is rendered untouched — pages decide how tall it is, what
 * colour, what content. The shell only owns layout.
 */
const DriverScreenShell = ({
  header,
  children,
  bodyClassName = '',
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col bg-bg ${className}`}
      style={{ height: 'calc(100dvh - 4rem)' }}
    >
      {header && (
        <div className="shrink-0">
          {header}
        </div>
      )}
      <div
        className={`flex-1 min-h-0 overflow-y-auto overscroll-contain ${bodyClassName}`}
      >
        {children}
      </div>
    </div>
  );
};

export default DriverScreenShell;
