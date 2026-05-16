const Badge = ({
  children,
  variant = 'default',
  className = '',
}) => {
  const variants = {
    default: 'bg-gray-100 text-text-secondary',
    primary: 'bg-primary/15 text-primary-dark',
    success: 'bg-success-light text-green-700',
    danger: 'bg-danger-light text-danger',
    warning: 'bg-amber-100 text-amber-700',
    info: 'bg-blue-100 text-blue-700',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
};

export default Badge;
