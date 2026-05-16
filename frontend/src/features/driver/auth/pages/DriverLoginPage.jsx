import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Button from '../../../../components/Button';
import Input from '../../../../components/Input';
import { Phone, Lock, ArrowLeft } from 'lucide-react';
import api from '../../../../utils/api';
import useDriverAuthStore from '../../../../store/useDriverAuthStore';

const DriverLoginPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, driver, setAuth } = useDriverAuthStore();

  useEffect(() => {
    if (isAuthenticated && driver) {
      if (driver.approvalStatus === 'approved') {
        navigate('/driver/home');
      } else if (driver.onboardingStep < 5) {
        switch (driver.onboardingStep) {
          case 0: navigate('/driver/register/identity'); break;
          case 1: navigate('/driver/register/credentials'); break;
          case 2: navigate('/driver/register/bank'); break;
          case 3: navigate('/driver/register/safety'); break;
          case 4: navigate('/driver/register/training'); break;
          default: navigate('/driver/register/credentials');
        }
      } else {
        navigate('/driver/register/approval');
      }
    }
  }, [isAuthenticated, driver, navigate]);
  
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
      const res = await api.post('/driver/auth/login', formData);
      const { driver } = res.data.data;
      
      setAuth(driver);

      // Redirection logic
      if (driver.approvalStatus === 'approved') {
        navigate('/driver/home');
      } else if (driver.onboardingStep < 5) {
        switch (driver.onboardingStep) {
          case 0: navigate('/driver/register/identity'); break;
          case 1: navigate('/driver/register/credentials'); break;
          case 2: navigate('/driver/register/bank'); break;
          case 3: navigate('/driver/register/safety'); break;
          case 4: navigate('/driver/register/training'); break;
          default: navigate('/driver/register/credentials');
        }
      } else {
        navigate('/driver/register/approval');
      }

    } catch (error) {
      console.error('Login failed', error);
      setErrors({ phone: error.response?.data?.message || 'Login failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-white min-h-dvh">
      {/* Header */}
      <div className="px-4 pt-4">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-text" />
        </button>
      </div>

      <div className="flex-1 flex flex-col px-6 pt-6">
        {/* Title */}
        <div className="mb-8 animate-fade-in-up">
          <h1 className="text-2xl font-bold text-text mb-1">Driver Login</h1>
          <p className="text-text-secondary text-sm">Welcome back, partner!</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <div>
            <label className="text-sm font-medium text-text mb-1.5 block">Mobile number</label>
            <div className="flex gap-2">
              <div className="h-12 px-3 bg-gray-50 border border-border rounded-xl flex items-center text-sm text-text-secondary font-medium shrink-0">
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

          <Input
            label="Password"
            type="password"
            placeholder="Enter your password"
            value={formData.password}
            onChange={handleChange('password')}
            error={errors.password}
            icon={Lock}
          />

          <Button type="submit" fullWidth loading={loading} className="mt-6 rounded-full py-4 text-base font-bold shadow-lg shadow-primary/20">
            LOGIN
          </Button>
        </form>

        {/* Register Link */}
        <p className="text-center text-sm text-text-secondary mt-8 mb-6 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          Don't have an account?{' '}
          <Link to="/driver/signup" className="text-primary font-semibold hover:underline">
            Sign Up
          </Link>
        </p>
      </div>
    </div>
  );
};

export default DriverLoginPage;
