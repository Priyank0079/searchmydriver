import { Loader2 } from 'lucide-react';

export const Spinner = ({ size = 'md', className = '' }) => {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  };

  return (
    <Loader2 className={`${sizes[size]} animate-spin text-primary ${className}`} />
  );
};

export const PageLoader = ({ message = 'Loading...' }) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 py-20">
      <Spinner size="xl" />
      <p className="text-sm text-text-secondary">{message}</p>
    </div>
  );
};

export const Skeleton = ({ className = '', rounded = false }) => {
  return (
    <div
      className={`bg-gray-200 animate-pulse ${rounded ? 'rounded-full' : 'rounded-lg'} ${className}`}
    />
  );
};

export default Spinner;
