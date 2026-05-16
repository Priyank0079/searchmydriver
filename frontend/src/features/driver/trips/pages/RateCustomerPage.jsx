import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../../../components/Card';
import Button from '../../../../components/Button';
import StarRating from '../../../../components/StarRating';

const RateCustomerPage = () => {
  const navigate = useNavigate();
  const [rating, setRating] = useState(0);

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-white min-h-dvh px-6">
      <h1 className="text-xl font-bold text-text mb-2 animate-fade-in-up">Rate Customer</h1>
      <p className="text-sm text-text-muted mb-8 animate-fade-in-up">How was your experience with the customer?</p>

      <div className="animate-bounce-in mb-8">
        <StarRating value={rating} onChange={setRating} size="lg" showLabel />
      </div>

      <div className="w-full animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
        <Button fullWidth disabled={!rating} onClick={() => navigate('/driver/home')}>
          SUBMIT RATING
        </Button>
      </div>
    </div>
  );
};

export default RateCustomerPage;
