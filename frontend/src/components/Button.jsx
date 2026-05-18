import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

const variants = {
  /** Yellow brand — best on dark headers, not on white cards */
  primary: 'bg-primary text-slate-900 font-semibold shadow-sm hover:bg-primary-dark active:scale-[0.97]',
  /** Main CTA on white driver screens */
  driver:
    'bg-slate-900 text-white font-semibold shadow-lg hover:bg-slate-800 ring-2 ring-primary/40 active:scale-[0.98]',
  secondary: 'bg-white text-slate-800 border border-slate-200 font-semibold hover:bg-slate-50 active:scale-[0.97]',
  outline:
    'bg-white text-slate-700 border border-slate-300 font-semibold hover:bg-slate-50 hover:border-slate-400 active:scale-[0.97]',
  danger: 'bg-danger text-white font-semibold hover:bg-red-600 active:scale-[0.97]',
  ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 active:scale-[0.97]',
  dark: 'bg-slate-900 text-white font-semibold hover:bg-slate-800 active:scale-[0.97]',
  success: 'bg-emerald-600 text-white font-semibold hover:bg-emerald-700 active:scale-[0.97]',
  /** Best on white admin panels — high contrast CTA */
  admin: 'bg-slate-900 text-white font-semibold shadow-md hover:bg-slate-800 active:scale-[0.98]',
  /** Accent CTA on admin — primary tint without low contrast on white */
  adminAccent:
    'bg-slate-900 text-primary font-semibold shadow-md ring-2 ring-primary/50 hover:bg-slate-800 active:scale-[0.98]',
};

const sizes = {
  sm: 'h-9 px-4 text-sm rounded-lg',
  md: 'h-11 px-5 text-sm rounded-xl',
  lg: 'h-13 px-6 text-base rounded-xl',
  xl: 'h-14 px-8 text-base rounded-2xl',
};

const Button = forwardRef(({
  children,
  variant = 'primary',
  size = 'lg',
  fullWidth = false,
  loading = false,
  disabled = false,
  icon: Icon,
  iconRight: IconRight,
  className = '',
  ...props
}, ref) => {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center gap-2
        transition-all duration-200 cursor-pointer
        disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
        ${variants[variant]}
        ${sizes[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : (
        <>
          {Icon && <Icon className="w-5 h-5" />}
          {children}
          {IconRight && <IconRight className="w-5 h-5" />}
        </>
      )}
    </button>
  );
});

Button.displayName = 'Button';
export default Button;
