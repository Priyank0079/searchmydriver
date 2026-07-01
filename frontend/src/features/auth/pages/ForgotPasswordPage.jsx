import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Button from '../../../components/Button';
import Input from '../../../components/Input';
import { Phone, Lock, ArrowLeft, KeyRound, CheckCircle2 } from 'lucide-react';
import api from '../../../utils/api';

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const role = location.pathname.includes('/driver/') ? 'driver' : 'user';

  const [step, setStep] = useState(1); // 1: Phone, 2: OTP & New Password, 3: Success
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setError('');
    if (!phone || phone.length !== 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/forgot-password/send-otp', { phone, role });
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    if (!otp || otp.length < 4) {
      setError('Please enter a valid OTP');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/forgot-password/reset', { phone, otp, newPassword, role });
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-gradient-to-b from-[#FFFDF5] via-[#FFFBF0] to-[#FFF8E7] min-h-dvh justify-between">
      {/* Top Header Row */}
      <div className="px-4 pt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2.5 rounded-full bg-white/80 border border-amber-100/50 shadow-sm hover:bg-amber-50 text-slate-700 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="text-xs font-black uppercase tracking-widest text-slate-500">Security Access</span>
      </div>

      {/* Centered Floating Card */}
      <div className="flex-1 flex flex-col justify-center px-4 py-8">
        <div className="w-full max-w-[390px] mx-auto bg-white rounded-[28px] border border-amber-100/80 p-6 sm:p-7 shadow-xl shadow-amber-900/5 animate-fade-in-up">
          {step === 3 ? (
            <div className="flex flex-col items-center text-center py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-5 border-4 border-green-50">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-none mb-2">
                Password Reset!
              </h2>
              <p className="text-slate-500 text-sm font-medium mb-8">
                Your password has been changed successfully. You can now login with your new password.
              </p>
              <Button
                variant="dark"
                fullWidth
                onClick={() => navigate(role === 'driver' ? '/driver/login' : '/login')}
                className="rounded-full py-3 text-sm font-bold shadow-lg shadow-slate-950/15"
              >
                Back to Login
              </Button>
            </div>
          ) : (
            <>
              {/* Logo */}
              <div className="flex justify-center mb-5">
                <img src="/images/logo-smd.png" alt="SearchMyDrivers Logo" className="h-9 w-auto object-contain" />
              </div>

              {/* Heading */}
              <div className="text-center mb-6">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-none">
                  Forgot Password
                </h1>
                <p className="text-slate-500 text-[11px] sm:text-xs font-bold uppercase tracking-wider mt-1.5">
                  {step === 1 ? 'Enter phone to reset' : 'Enter OTP to verify'}
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl font-medium text-center">
                  {error}
                </div>
              )}

              {step === 1 ? (
                <form onSubmit={handleRequestOtp} className="space-y-4">
                  <div>
                    <label className="text-xs font-extrabold text-slate-800 mb-1.5 block uppercase tracking-wider">
                      Phone Number
                    </label>
                    <div className="flex gap-2">
                      <div className="h-11 px-3 bg-amber-50/50 border border-amber-150 rounded-xl flex items-center text-sm text-amber-900 font-extrabold shrink-0 shadow-inner">
                        +91
                      </div>
                      <Input
                        type="tel"
                        placeholder="10-digit number"
                        value={phone}
                        onChange={(e) => {
                          setPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
                          setError('');
                        }}
                        icon={Phone}
                        maxLength={10}
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    variant="dark"
                    fullWidth
                    loading={loading}
                    className="rounded-full py-3 text-sm font-bold shadow-lg shadow-slate-950/15 mt-4"
                  >
                    Send OTP
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div>
                    <label className="text-xs font-extrabold text-slate-800 mb-1.5 block uppercase tracking-wider">
                      Enter OTP
                    </label>
                    <Input
                      type="text"
                      placeholder="6-digit OTP"
                      value={otp}
                      onChange={(e) => {
                        setOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                        setError('');
                      }}
                      icon={KeyRound}
                      maxLength={6}
                    />
                    <p className="text-[10px] text-slate-400 font-medium mt-1.5 px-1">
                      OTP sent to +91 {phone}
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-extrabold text-slate-800 mb-1.5 block uppercase tracking-wider">
                      New Password
                    </label>
                    <Input
                      type="password"
                      placeholder="At least 6 characters"
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        setError('');
                      }}
                      icon={Lock}
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="dark"
                    fullWidth
                    loading={loading}
                    className="rounded-full py-3 text-sm font-bold shadow-lg shadow-slate-950/15 mt-4"
                  >
                    Reset Password
                  </Button>
                </form>
              )}
            </>
          )}
        </div>
      </div>

      {/* Footer space to balance visually */}
      <div className="py-4 text-center">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          © SearchMyDriver Security
        </p>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
