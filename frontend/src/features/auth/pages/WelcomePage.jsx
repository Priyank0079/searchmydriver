import { useNavigate } from 'react-router-dom';
import Button from '../../../components/Button';

const WelcomePage = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col bg-white min-h-dvh relative">
      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-6 relative z-10">
        <div className="text-center mb-2 animate-fade-in-up w-full max-w-[180px] mx-auto" style={{ animationDelay: '0.1s' }}>
          <img src="/images/logo-smd.png" alt="SearchMyDrivers Logo" className="w-full h-auto object-contain" />
        </div>
        
        <div className="text-center mt-2">
          <p className="text-slate-900 text-[22px] font-black leading-tight tracking-tight">
            Your Car<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-600 to-amber-500">Our Professional Driver</span>
          </p>
          <p className="text-slate-500 text-xs font-bold mt-1.5 uppercase tracking-wider">Safe • Verified • On-Time</p>
        </div>

        <div className="w-full max-w-[210px] my-4 animate-fade-in-up flex items-center justify-center" style={{ animationDelay: '0.15s' }}>
          <img src="/images/car-driver.png" alt="Driver with car" className="w-full h-auto object-contain drop-shadow-lg" />
        </div>
      </div>

      {/* Buttons */}
      <div className="px-6 pb-6 space-y-2.5 relative z-10 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
        <Button fullWidth onClick={() => navigate('/login')} className="rounded-full py-2.5 text-sm font-bold shadow-md shadow-primary/10">
          Login
        </Button>
        <Button variant="outline" fullWidth onClick={() => navigate('/register')} className="rounded-full py-2.5 bg-black text-black font-bold border-gray-200 text-sm hover:bg-gray-100 text-black">
          Sign Up
        </Button>
      </div>

    </div>
  );
};

export default WelcomePage;
