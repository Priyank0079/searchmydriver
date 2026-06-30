import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Button from '../../../components/Button';
import Input from '../../../components/Input';
import { Phone, Lock, ArrowLeft } from 'lucide-react';
import api from '../../../utils/api';
import useUserAuthStore from '../../../store/useUserAuthStore';
import { navigateUserAfterAuth } from '../utils/authNavigation';

const LoginPage = () => {
  const navigate = useNavigate();
  const setAuth = useUserAuthStore((state) => state.setAuth);
  const [formData, setFormData] = useState({ phone: '', password: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleChange = (field) => (e) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.phone) newErrors.phone = 'Phone number is required';
    else if (!/^[0-9]{10}$/.test(formData.phone)) newErrors.phone = 'Enter valid 10-digit number';
    if (!formData.password) newErrors.password = 'Password is required';
    else if (formData.password.length < 6) newErrors.password = 'Min 6 characters';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);

    try {
      const res = await api.post('/auth/login', {
        phone: formData.phone,
        password: formData.password,
      });
      const { user } = res.data.data;
      setAuth(user);
      navigateUserAfterAuth(navigate, user);
    } catch (error) {
      console.error('Login failed', error);
      setErrors({ phone: error.response?.data?.message || 'Login failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-gradient-to-b from-[#FFFDF5] via-[#FFFBF0] to-[#FFF8E7] min-h-dvh justify-between">
      {/* Top Header Row */}
      <div className="px-4 pt-4 flex items-center justify-between">
        <button type="button" onClick={() => navigate(-1)} className="p-2.5 rounded-full bg-white/80 border border-amber-100/50 shadow-sm hover:bg-amber-50 text-slate-700 hover:text-slate-900 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="text-xs font-black uppercase tracking-widest text-slate-500">Security Access</span>
      </div>

      {/* Centered Floating Card */}
      <div className="flex-1 flex flex-col justify-center px-4 py-8">
        <div className="w-full max-w-[390px] mx-auto bg-white rounded-[28px] border border-amber-100/80 p-6 sm:p-7 shadow-xl shadow-amber-900/5 animate-fade-in-up">
          {/* Logo */}
          <div className="flex justify-center mb-5">
            <img src="/images/logo-smd.png" alt="SearchMyDrivers Logo" className="h-9 w-auto object-contain" />
          </div>

          {/* Heading */}
          <div className="text-center mb-6">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-none">Welcome Back!</h1>
            <p className="text-slate-500 text-[11px] sm:text-xs font-bold uppercase tracking-wider mt-1.5">Login to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-extrabold text-slate-800 mb-1.5 block uppercase tracking-wider">Phone Number</label>
              <div className="flex gap-2">
                <div className="h-11 px-3 bg-amber-50/50 border border-amber-150 rounded-xl flex items-center text-sm text-amber-900 font-extrabold shrink-0 shadow-inner">
                  +91
                </div>
                <Input
                  type="tel"
                  placeholder="10-digit number"
                  value={formData.phone}
                  onChange={handleChange('phone')}
                  error={errors.phone}
                  icon={Phone}
                  maxLength={10}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-extrabold text-slate-800 mb-1.5 block uppercase tracking-wider">Password</label>
              <Input
                type="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange('password')}
                error={errors.password}
                icon={Lock}
              />
            </div>

            <div className="flex justify-end pt-1">
              <Link to="/forgot-password" className="text-xs text-amber-600 font-bold hover:text-amber-700 hover:underline">
                Forgot Password?
              </Link>
            </div>

            <Button type="submit" variant="dark" fullWidth loading={loading} className="rounded-full py-3 text-sm font-bold shadow-lg shadow-slate-950/15 mt-2">
              Login
            </Button>
          </form>

          <p className="text-center text-xs text-slate-500 mt-6 font-semibold">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="text-amber-600 font-bold hover:text-amber-700 hover:underline">
              Sign Up
            </Link>
          </p>
        </div>
      </div>

      {/* Footer copyright space to balance visually */}
      <div className="py-4 text-center">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">© SearchMyDriver Security</p>
      </div>
    </div>

  );
};

export default LoginPage;
