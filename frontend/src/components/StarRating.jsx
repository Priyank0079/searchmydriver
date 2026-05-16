import { useState } from 'react';
import { Star } from 'lucide-react';

const StarRating = ({
  value = 0,
  onChange,
  size = 'md',
  readOnly = false,
  showLabel = false,
  className = '',
}) => {
  const [hoverValue, setHoverValue] = useState(0);
  const labels = ['', 'Poor', 'Below Average', 'Good', 'Very Good', 'Excellent'];

  const sizes = {
    sm: 'w-5 h-5',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = star <= (hoverValue || value);
          return (
            <button
              key={star}
              type="button"
              disabled={readOnly}
              onClick={() => onChange?.(star)}
              onMouseEnter={() => !readOnly && setHoverValue(star)}
              onMouseLeave={() => !readOnly && setHoverValue(0)}
              className={`transition-all duration-150 ${readOnly ? 'cursor-default' : 'cursor-pointer hover:scale-110 active:scale-95'}`}
            >
              <Star
                className={`${sizes[size]} transition-colors ${isFilled ? 'text-primary fill-primary' : 'text-gray-300'}`}
              />
            </button>
          );
        })}
      </div>
      {showLabel && (hoverValue || value) > 0 && (
        <p className="text-sm text-text-secondary font-medium">
          {labels[hoverValue || value]}
        </p>
      )}
    </div>
  );
};

export default StarRating;
