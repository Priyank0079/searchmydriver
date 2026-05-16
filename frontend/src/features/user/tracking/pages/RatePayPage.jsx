import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../../../components/Card';
import Button from '../../../../components/Button';
import StarRating from '../../../../components/StarRating';
import { Star } from 'lucide-react';

const RatePayPage = () => {
  const navigate = useNavigate();
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');

  return (
    <div className="flex-1 flex flex-col bg-white min-h-dvh px-6 pt-16 pb-8">
      <div className="flex-1 flex flex-col items-center">
        <h1 className="text-xl font-bold text-text mb-2 animate-fade-in-up">How was your experience?</h1>
        <p className="text-sm text-text-muted mb-8 animate-fade-in-up">Rate your driver</p>

        <div className="animate-bounce-in mb-8">
          <StarRating value={rating} onChange={setRating} size="lg" showLabel />
        </div>

        <Card className="w-full animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <textarea
            placeholder="Write a review (optional)"
            value={review}
            onChange={(e) => setReview(e.target.value)}
            rows={3}
            className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </Card>
      </div>

      <Button fullWidth onClick={() => navigate('/user/tracking/invoice')} disabled={!rating}>
        Submit
      </Button>
    </div>
  );
};

export default RatePayPage;
