import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../../components/Button';
import Input from '../../../components/Input';
import { Mail, ArrowLeft } from 'lucide-react';

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSent(true);
    }, 1500);
  };

  return (
    <div className="flex-1 flex flex-col bg-white min-h-dvh">
      {/* Header */}
      <div className="px-4 pt-4">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-text" />
        </button>
      </div>

      <div className="flex-1 flex flex-col px-6 pt-8">
        {sent ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center animate-fade-in-up">
            <div className="w-16 h-16 bg-success-light rounded-full flex items-center justify-center mb-4">
              <Mail className="w-7 h-7 text-success" />
            </div>
            <h2 className="text-xl font-bold text-text mb-2">Check Your Email</h2>
            <p className="text-sm text-text-secondary mb-8">
              We've sent a password reset link to<br />
              <span className="font-medium text-text">{email}</span>
            </p>
            <Button variant="secondary" onClick={() => navigate('/login')}>
              Back to Login
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-8 animate-fade-in-up">
              <h1 className="text-2xl font-bold text-text mb-2">Forgot Password?</h1>
              <p className="text-text-secondary text-sm">
                Enter your email address and we'll send you a link to reset your password.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
              <Input
                label="Email Address"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                icon={Mail}
              />

              <Button type="submit" fullWidth loading={loading}>
                Send Reset Link
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
