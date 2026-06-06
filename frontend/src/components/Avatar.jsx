import { useEffect, useState } from 'react';
import { getInitials } from '../utils/formatters';

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-20 h-20 text-2xl',
};

const Avatar = ({
  src,
  name,
  size = 'md',
  online,
  className = '',
}) => {
  // Track image-load failures so a broken / 403 URL falls back to the
  // initials bubble instead of showing the browser's default broken
  // image glyph. Reset whenever `src` changes so a fresh URL gets a
  // fresh chance.
  const [errored, setErrored] = useState(false);
  useEffect(() => {
    setErrored(false);
  }, [src]);

  const showImage = !!src && !errored;

  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      {showImage ? (
        <img
          src={src}
          alt={name || 'Avatar'}
          onError={() => setErrored(true)}
          className={`${sizeClasses[size]} rounded-full object-cover bg-gray-100`}
        />
      ) : (
        <div className={`${sizeClasses[size]} rounded-full bg-primary/15 text-primary font-semibold flex items-center justify-center`}>
          {getInitials(name)}
        </div>
      )}
      {online !== undefined && (
        <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${online ? 'bg-success' : 'bg-gray-300'}`} />
      )}
    </div>
  );
};

export default Avatar;
