import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const Input = forwardRef(({
  label,
  type = 'text',
  error,
  icon: Icon,
  rightIcon: RightIcon,
  helper,
  className = '',
  containerClassName = '',
  ...props
}, ref) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
      {label && (
        <label className="text-sm font-medium text-text">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
            <Icon className="w-5 h-5" />
          </div>
        )}
        <input
          ref={ref}
          type={inputType}
          className={`
            w-full h-12 bg-white border rounded-xl px-4 text-sm text-text
            placeholder:text-text-muted
            focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
            transition-all duration-200
            ${Icon ? 'pl-11' : ''}
            ${isPassword || RightIcon ? 'pr-11' : ''}
            ${error ? 'border-danger focus:ring-danger/30 focus:border-danger' : 'border-border'}
            ${className}
          `}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text p-1"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        )}
        {RightIcon && !isPassword && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted">
            <RightIcon className="w-5 h-5" />
          </div>
        )}
      </div>
      {error && (
        <p className="text-xs text-danger mt-0.5">{error}</p>
      )}
      {helper && !error && (
        <p className="text-xs text-text-muted mt-0.5">{helper}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';
export default Input;
