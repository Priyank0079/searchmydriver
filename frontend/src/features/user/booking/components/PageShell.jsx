import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Shared mobile-page shell used across the booking flow.
 *
 *   ┌──────────────────────┐
 *   │ ← Title  · subtitle  │  ← sticky header (white)
 *   ├──────────────────────┤
 *   │                      │
 *   │   {children}         │  ← scrollable content
 *   │                      │
 *   ├──────────────────────┤
 *   │ {footer}             │  ← optional sticky footer
 *   └──────────────────────┘
 *
 * Keeps every booking screen visually consistent without each page
 * re-implementing back-buttons, header copy, and padding.
 */
const PageShell = ({
  title,
  subtitle,
  onBack,
  rightSlot = null,
  footer = null,
  children,
  contentClassName = '',
  bodyTone = 'bg-bg',
}) => {
  const navigate = useNavigate();
  const handleBack = onBack || (() => navigate(-1));

  return (
    <div className={`flex-1 flex flex-col min-h-dvh ${bodyTone}`}>
      <div className="bg-white px-4 pt-4 pb-3 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="p-2 -ml-2 rounded-xl hover:bg-gray-100"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 text-text" />
          </button>
          <div className="min-w-0 flex-1">
            {title && <h1 className="text-lg font-bold text-text truncate">{title}</h1>}
            {subtitle && (
              <p className="text-xs text-text-muted truncate">{subtitle}</p>
            )}
          </div>
          {rightSlot}
        </div>
      </div>

      <div className={`flex-1 ${contentClassName || 'p-4'}`}>{children}</div>

      {footer && (
        <div className="bg-white border-t border-border-light px-4 py-3">{footer}</div>
      )}
    </div>
  );
};

export default PageShell;
