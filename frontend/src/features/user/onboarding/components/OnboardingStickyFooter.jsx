import Button from '../../../../components/Button';

const OnboardingStickyFooter = ({
  label,
  onClick,
  loading = false,
  disabled = false,
  hint,
  className = '',
}) => (
  <div
    className={`fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 shadow-[0_-8px_30px_rgba(0,0,0,0.06)] max-w-lg mx-auto z-10 ${className}`}
  >
    <Button
      fullWidth
      onClick={onClick}
      loading={loading}
      disabled={disabled || loading}
      className="rounded-full py-4 text-base font-bold"
    >
      {label}
    </Button>
    {hint && (
      <p className="text-xs text-center text-amber-700 mt-2 font-medium">{hint}</p>
    )}
  </div>
);

export default OnboardingStickyFooter;
