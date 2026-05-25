import { useCallback, useEffect, useRef } from 'react';

/**
 * Boxed numeric PIN input. `length` digits, each its own focusable cell.
 * Used for the start-of-ride OTP today; lives in `components/inputs` so any
 * future flow needing a short numeric code can reuse it.
 *
 *   props:
 *     - value      Controlled string. Non-digit characters are dropped.
 *     - onChange   Called with the new value on every keystroke.
 *     - length     Number of cells. Default 4.
 *     - autoFocus  Focuses the first cell on mount.
 *     - disabled   Disables every cell.
 *     - error      When truthy, the cells render with a danger border.
 *     - onComplete Optional callback once `value.length === length`.
 *     - inputMode  Defaults to "numeric" for mobile keypads.
 */
const PinInput = ({
  value = '',
  onChange,
  length = 4,
  autoFocus = false,
  disabled = false,
  error = false,
  onComplete,
  inputMode = 'numeric',
}) => {
  const refs = useRef([]);

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  useEffect(() => {
    if (value.length === length && onComplete) onComplete(value);
  }, [value, length, onComplete]);

  const setCell = useCallback(
    (idx, ch) => {
      const cleaned = ch.replace(/\D/g, '').slice(-1);
      const chars = (value || '').padEnd(length, '').split('').slice(0, length);
      chars[idx] = cleaned || '';
      const next = chars.join('').replace(/\s/g, '').slice(0, length);
      onChange?.(next);
      if (cleaned && idx < length - 1) {
        refs.current[idx + 1]?.focus();
      }
    },
    [length, onChange, value],
  );

  const handleKeyDown = (idx) => (event) => {
    if (event.key === 'Backspace') {
      event.preventDefault();
      const chars = (value || '').split('');
      if (chars[idx]) {
        chars[idx] = '';
        onChange?.(chars.join(''));
      } else if (idx > 0) {
        const prev = idx - 1;
        chars[prev] = '';
        onChange?.(chars.join(''));
        refs.current[prev]?.focus();
      }
    } else if (event.key === 'ArrowLeft' && idx > 0) {
      event.preventDefault();
      refs.current[idx - 1]?.focus();
    } else if (event.key === 'ArrowRight' && idx < length - 1) {
      event.preventDefault();
      refs.current[idx + 1]?.focus();
    }
  };

  const handlePaste = (event) => {
    const text = (event.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, length);
    if (!text) return;
    event.preventDefault();
    onChange?.(text);
    const nextIdx = Math.min(text.length, length - 1);
    refs.current[nextIdx]?.focus();
  };

  return (
    <div className="flex items-center justify-center gap-2.5" onPaste={handlePaste}>
      {Array.from({ length }).map((_, idx) => {
        const ch = value?.[idx] || '';
        return (
          <input
            key={`pin-${idx}`}
            ref={(el) => {
              refs.current[idx] = el;
            }}
            type="text"
            inputMode={inputMode}
            value={ch}
            disabled={disabled}
            maxLength={1}
            onChange={(event) => setCell(idx, event.target.value)}
            onKeyDown={handleKeyDown(idx)}
            className={`w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-bold rounded-2xl border-2 transition outline-none ${
              error
                ? 'border-danger bg-danger/5 text-danger focus:border-danger'
                : 'border-border bg-white text-text focus:border-primary'
            } disabled:opacity-60`}
          />
        );
      })}
    </div>
  );
};

export default PinInput;
