import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../../../components/Button';
import Input from '../../../../components/Input';
import StepIndicator from '../../../../components/StepIndicator';
import Modal from '../../../../components/Modal';
import { ArrowLeft, User, Phone, Lock } from 'lucide-react';
import api from '../../../../utils/api';
import useDriverAuthStore from '../../../../store/useDriverAuthStore';
import GoogleSignInButton from '../../../auth/components/GoogleSignInButton';
import AuthDivider from '../../../auth/components/AuthDivider';
import useGoogleAuth from '../../../auth/hooks/useGoogleAuth';
import { driverNeedsPhone, navigateDriverAfterAuth } from '../../../auth/utils/authNavigation';

const steps = ['Identity', 'Credentials', 'Bank', 'Safety', 'Training'];

const IdentityDetailsPage = () => {
  const navigate = useNavigate();
  const { driver, isAuthenticated, setAuth } = useDriverAuthStore();
  
  useEffect(() => {
    if (!isAuthenticated || !driver) return;
    if (driverNeedsPhone(driver)) {
      navigate('/driver/link-phone', { replace: true });
      return;
    }
    if (driver.onboardingStep >= 1) {
      navigateDriverAfterAuth(navigate, driver);
    }
  }, [isAuthenticated, driver?.id, driver?.phone, driver?.onboardingStep, driver?.approvalStatus, navigate]);

  const [form, setForm] = useState({ name: '', phone: '', password: '' });
  const { handleGoogleSuccess, handleGoogleError, loading: googleLoading } = useGoogleAuth('driver');
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }));

  const handleSendOtp = async () => {
    try {
      setLoading(true);
      setError('');
      await api.post('/driver/auth/send-otp', { phone: form.phone });
      setShowOtpModal(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    try {
      setLoading(true);
      setError('');
      // This endpoint verifies OTP and registers the user
      const res = await api.post('/driver/auth/verify-otp', {
        phone: form.phone,
        otp,
        name: form.name,
        password: form.password,
      });

      // Save driver to store (token is in cookies)
      setAuth(res.data.data.driver);
      
      setIsPhoneVerified(true);
      setShowOtpModal(false);
      navigate('/driver/register/credentials');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    if (isPhoneVerified) {
      navigate('/driver/register/credentials');
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-white min-h-dvh">
      <div className="px-4 pt-4">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>
      <div className="px-6 pt-2 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-bold">Identity Legal</h1>
          <span className="text-xs text-text-muted bg-bg px-2 py-1 rounded-full">1/5</span>
        </div>
        <StepIndicator steps={steps} currentStep={1} />
        <p className="text-xs text-text-muted mt-3">Secure account creation</p>
      </div>
      
      <div className="flex-1 flex flex-col px-6 pb-8">
        <div className="flex-1 space-y-4 animate-fade-in-up">
          <GoogleSignInButton
            onSuccess={handleGoogleSuccess}
            onError={handleGoogleError}
            text="signup_with"
            disabled={googleLoading || isPhoneVerified}
          />
          <AuthDivider label="or register with phone" />
          <Input label="Full name" placeholder="As per Govt. ID" value={form.name} onChange={handleChange('name')} icon={User} />
          <Input label="Password" type="password" placeholder="Min 6 characters" value={form.password} onChange={handleChange('password')} icon={Lock} />
          
          <div>
            <label className="text-sm font-medium text-text mb-1.5 block">Mobile number</label>
            <div className="flex gap-2">
              <div className="h-12 px-3 bg-gray-50 border border-border rounded-xl flex items-center text-sm text-text-secondary font-medium shrink-0">+91</div>
              <div className="flex-1 relative">
                <Input type="tel" placeholder="10-digit number" value={form.phone} onChange={handleChange('phone')} icon={Phone} maxLength={10} disabled={isPhoneVerified} />
                {form.phone.length === 10 && !isPhoneVerified && (
                  <button 
                    type="button"
                    onClick={handleSendOtp}
                    disabled={loading || !form.name || !form.password}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-primary text-text text-xs font-bold rounded-lg disabled:opacity-50"
                  >
                    {loading ? 'Sending...' : 'Verify'}
                  </button>
                )}
                {isPhoneVerified && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-success text-xs font-bold">
                    ✓ Verified
                  </span>
                )}
              </div>
            </div>
            {error && <p className="text-danger text-xs mt-1">{error}</p>}
          </div>

        </div>
        
        <Button 
          fullWidth 
          onClick={handleContinue} 
          disabled={!isPhoneVerified}
          className="mt-6 rounded-full py-4 text-base font-bold shadow-lg shadow-primary/20"
        >
          {isPhoneVerified ? 'CONTINUE' : 'VERIFY PHONE TO CONTINUE'}
        </Button>
      </div>

      {/* OTP Modal */}
      <Modal isOpen={showOtpModal} onClose={() => setShowOtpModal(false)} title="Enter OTP">
        <div className="p-2">
          <p className="text-sm text-text-secondary mb-4">We sent a 6-digit code to +91 {form.phone}</p>
          <Input 
            type="text" 
            placeholder="000000" 
            value={otp} 
            onChange={(e) => setOtp(e.target.value)} 
            maxLength={6} 
            className="text-center text-xl tracking-widest font-mono"
          />
          {error && <p className="text-danger text-xs mt-2 text-center">{error}</p>}
          <Button 
            fullWidth 
            className="mt-6" 
            onClick={handleVerifyOtp} 
            disabled={otp.length !== 6 || loading}
          >
            {loading ? 'Verifying...' : 'Verify & Create Account'}
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default IdentityDetailsPage;
