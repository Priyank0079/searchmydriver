import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../../../components/Button';
import { Shield, CheckCircle, Clock } from 'lucide-react';
import useDriverAuthStore from '../../../../store/useDriverAuthStore';

const DriverSignUpPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, driver } = useDriverAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      if (driver?.approvalStatus === 'approved') {
        navigate('/driver/home');
      } else if (driver?.onboardingStep >= 5) {
        navigate('/driver/register/approval');
      } else if (driver?.onboardingStep === 4) {
        navigate('/driver/register/training');
      } else if (driver?.onboardingStep === 3) {
        navigate('/driver/register/safety');
      } else if (driver?.onboardingStep >= 1) {
        navigate('/driver/register/credentials');
      }
    }
  }, [isAuthenticated, driver, navigate]);

  return (
    <div className="flex-1 flex flex-col bg-white min-h-dvh relative">
      <div className="flex-1 flex flex-col items-center justify-center px-8 pt-12 pb-6">
        <div className="text-center mb-8 animate-fade-in-up w-full max-w-[400px] mx-auto">
          <img src="/images/logo-white.png" alt="SpareDriver Logo" className="w-full h-auto object-contain" />
        </div>
        <p className="text-black text-[20px] font-medium mt-4">Drive. Earn. Grow.</p>

        <div className="flex-1 flex items-center justify-center w-full max-w-xs mx-auto animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
          <img src="/images/car-driver.png" alt="Driver with car" className="w-full h-auto object-contain drop-shadow-xl" />
        </div>
      </div>

      <div className="px-6 pb-12 space-y-4 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
        <Button fullWidth onClick={() => navigate('/driver/register/identity')} className="rounded-full py-4 text-base font-bold shadow-lg shadow-primary/20">
          Sign Up
        </Button>
        <Button variant="outline" fullWidth onClick={() => navigate('/driver/login')} className="rounded-full py-4 font-bold border-gray-200 bg-gray-200 text-black">
          Login
        </Button>
        <p className="text-center text-xs text-text-muted mt-4">
          Already have an account? <button onClick={() => navigate('/driver/login')} className="text-primary font-semibold hover:underline">Sign in</button>
        </p>
      </div>
    </div>
  );
};

export default DriverSignUpPage;
