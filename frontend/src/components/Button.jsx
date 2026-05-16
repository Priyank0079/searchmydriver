import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

const variants = {
  primary: 'bg-primary text-dark font-semibold hover:bg-primary-dark active:scale-[0.97]',
  secondary: 'bg-white text-dark border border-border font-semibold hover:bg-gray-50 active:scale-[0.97]',
  outline: 'bg-transparent text-primary border-2 border-primary font-semibold hover:bg-primary/10 active:scale-[0.97]',
  danger: 'bg-danger text-white font-semibold hover:bg-red-600 active:scale-[0.97]',
  ghost: 'bg-transparent text-text-secondary hover:bg-gray-100 active:scale-[0.97]',
  dark: 'bg-dark text-white font-semibold hover:bg-dark-light active:scale-[0.97]',
  success: 'bg-success text-white font-semibold hover:bg-green-600 active:scale-[0.97]',
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
