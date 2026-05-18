import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import DriverKitPurchaseSection from '../components/DriverKitPurchaseSection';

/** Dedicated kit page — same flow as home kit section */
const DriverKitPage = () => {
  const navigate = useNavigate();

  return (
    <div className="flex-1 flex flex-col bg-bg min-h-dvh">
      <div className="bg-dark px-4 pt-4 pb-5 rounded-b-3xl">
        <button type="button" onClick={() => navigate('/driver/home')} className="p-2 -ml-2 text-white/80">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold text-white mt-1">Driver kits</h1>
        <p className="text-xs text-white/60 mt-1">Select a kit and complete your order</p>
      </div>
      <div className="flex-1 p-4 -mt-2">
        <DriverKitPurchaseSection compact />
      </div>
    </div>
  );
};

export default DriverKitPage;
