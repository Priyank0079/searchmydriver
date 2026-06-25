import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Button from '../../../components/Button';
import Input from '../../../components/Input';
import Modal from '../../../components/Modal';
import { User, Phone, Lock, ArrowLeft } from 'lucide-react';
import api from '../../../utils/api';
import useUserAuthStore from '../../../store/useUserAuthStore';
import { navigateUserAfterAuth } from '../utils/authNavigation';


const RegisterPage = () => {
  const navigate = useNavigate();
  const setAuth = useUserAuthStore((state) => state.setAuth);
  
  const [formData, setFormData] = useState({ name: '', phone: '', password: '' });

  const [otp, setOtp] = useState('');
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (field) => (e) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    if (error) setError('');
  };

  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    if (!formData.name || !formData.phone || !formData.password) {
      setError('Please fill all required fields');
      return;
    }
    
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/send-otp', { phone: formData.phone });
      setShowOtpModal(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/verify-otp', {
        ...formData,
        otp
      });
      const { user } = res.data.data;
      setAuth(user);
      setIsPhoneVerified(true);
      setShowOtpModal(false);
      navigateUserAfterAuth(navigate, user);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-white min-h-dvh">
      <div className="px-4 pt-4">
        <button type="button" onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-text" />
        </button>
      </div>

      <div className="flex-1 flex flex-col px-6 pt-4 pb-8">
        <div className="mb-6 animate-fade-in-up">
          <h1 className="text-2xl font-bold text-text mb-1">Create Account</h1>
          <p className="text-text-secondary text-sm">Join SpareDriver and get started</p>
        </div>

        <form onSubmit={handleSendOtp} className="space-y-4 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <Input
            label="Full Name"
            placeholder="Enter your full name"
            value={formData.name}
            onChange={handleChange('name')}
            icon={User}
            required
          />

          <Input
            label="Password"
            type="password"
            placeholder="Min 6 characters"
            value={formData.password}
            onChange={handleChange('password')}
            icon={Lock}
            required
          />

          <div>
            <label className="text-sm font-medium text-text mb-1.5 block">Mobile Number</label>
            <div className="flex gap-2">
              <div className="h-12 px-3 bg-gray-50 border border-border rounded-xl flex items-center text-sm text-text-secondary font-medium shrink-0">
                +91
              </div>
              <Input
                type="tel"
                placeholder="10-digit number"
                value={formData.phone}
                onChange={handleChange('phone')}
                icon={Phone}
                maxLength={10}
                required
              />
            </div>
          </div>

          {error && <p className="text-danger text-xs font-medium">{error}</p>}

          <div className="pt-2">
            <Button type="submit" fullWidth loading={loading} className="rounded-full py-4 text-base font-bold shadow-lg shadow-primary/20">
              {loading ? 'Sending OTP...' : 'Verify Mobile Number'}
            </Button>
          </div>
        </form>



        <p className="text-center text-sm text-text-secondary mt-6 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          Already have an account?{' '}
          <Link to="/login" className="text-primary font-semibold hover:underline">
            Sign In
          </Link>
        </p>
      </div>

      {/* OTP Modal */}
      <Modal isOpen={showOtpModal} onClose={() => setShowOtpModal(false)} title="Verify Mobile">
        <div className="p-2 text-center">
          <p className="text-sm text-text-secondary mb-6">We sent a verification code to<br/><span className="font-bold text-text">+91 {formData.phone}</span></p>
          <Input
            type="text"
            placeholder="000000"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            maxLength={6}
            className="text-center text-2xl tracking-widest font-mono"
            autoFocus
          />
          {error && <p className="text-danger text-xs mt-2">{error}</p>}
          <Button
            fullWidth
            className="mt-8 rounded-full py-4"
            onClick={handleVerifyOtp}
            disabled={otp.length !== 6 || loading}
            loading={loading}
          >
            Verify & Continue
          </Button>
          <button 
            onClick={handleSendOtp} 
            disabled={loading}
            className="mt-6 text-sm font-bold text-primary hover:underline disabled:opacity-50"
          >
            Resend Code
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default RegisterPage;
