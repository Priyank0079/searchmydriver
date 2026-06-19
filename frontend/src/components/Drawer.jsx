import { useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * Reusable side-drawer component.
 *
 * Props:
 *  - isOpen       {boolean}    Whether the drawer is visible.
 *  - onClose      {function}   Called when backdrop is clicked or Escape is pressed.
 *  - width        {string}     Tailwind max-w-* class for panel width. Default 'max-w-[560px]'.
 *  - header       {ReactNode}  Rendered inside the fixed header section.
 *  - footer       {ReactNode}  Rendered inside the fixed footer section.
 *  - children     {ReactNode}  Scrollable body content.
 *  - side         {'right'|'left'} Which side to slide in from. Default 'right'.
 *
 * The component renders via a React portal directly into document.body so it is
 * always positioned relative to the viewport — completely unaffected by any
 * parent overflow / scroll context.
 */
const Drawer = ({
  isOpen,
  onClose,
  header,
  footer,
  children,
  width = 'max-w-[560px]',
  side = 'right',
}) => {
  // Lock body scroll while open
  useEffect(() => {
    if (!isOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow || '';
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const slideClass = side === 'left' ? 'animate-slide-in-left' : 'animate-slide-in-right';
  const panelPosition = side === 'left' ? 'left-0' : 'right-0';

  const drawerContent = (
    /* Full-screen overlay — fixed to viewport, above everything */
    <div
      className="fixed inset-0 z-[9999] flex overflow-hidden"
      style={{ justifyContent: side === 'left' ? 'flex-start' : 'flex-end' }}
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel — flex column so header/footer are sticky while body scrolls */}
      <aside
        className={`
          relative ${width} w-full h-full
          bg-white shadow-2xl flex flex-col
          ${slideClass}
          ${side === 'left' ? 'border-r' : 'border-l'} border-slate-200
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Fixed header ─────────────────────────────────────── */}
        {header && (
          <div className="shrink-0 border-b border-slate-100">
            {header}
          </div>
        )}

        {/* ── Scrollable body ──────────────────────────────────── */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {children}
        </div>

        {/* ── Fixed footer ─────────────────────────────────────── */}
        {footer && (
          <div className="shrink-0 border-t border-slate-100 bg-white">
            {footer}
          </div>
        )}
      </aside>
    </div>
  );

  return createPortal(drawerContent, document.body);
};

export default Drawer;
