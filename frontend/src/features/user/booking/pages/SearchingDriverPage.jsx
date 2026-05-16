import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Avatar from '../../../../components/Avatar';
import { Star, Phone, MessageSquare, MapPin } from 'lucide-react';

const SearchingDriverPage = () => {
  const navigate = useNavigate();
  const [found, setFound] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setFound(true), 4000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (found) {
      const t = setTimeout(() => navigate('/user/book/assigned'), 2000);
      return () => clearTimeout(t);
    }
  }, [found, navigate]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-white min-h-dvh px-6">
      {!found ? (
        <div className="flex flex-col items-center animate-fade-in-up">
          <div className="relative w-40 h-40 mb-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="absolute inset-0 rounded-full border-2 border-primary/30"
                style={{ animation: `pulse-ring 2s ease-out ${i * 0.6}s infinite` }} />
            ))}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 bg-primary/15 rounded-full flex items-center justify-center">
                <MapPin className="w-8 h-8 text-primary" />
              </div>
            </div>
          </div>
          <h2 className="text-xl font-bold text-text mb-2">Searching nearby drivers...</h2>
          <p className="text-sm text-text-muted text-center">This may take a few seconds</p>
          <div className="mt-6 flex items-center gap-2 px-4 py-2 bg-info/10 rounded-xl">
            <span className="text-xs text-info">ℹ️ If no driver is found within 3 minutes, booking will be cancelled and payment refunded.</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center animate-bounce-in">
          <div className="w-20 h-20 bg-success-light rounded-full flex items-center justify-center mb-4">
            <span className="text-4xl">✓</span>
          </div>
          <h2 className="text-xl font-bold text-success">Driver Assigned!</h2>
          <p className="text-sm text-text-muted mt-1">Redirecting...</p>
        </div>
      )}
    </div>
  );
};

export default SearchingDriverPage;
