import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../../../components/Button';
import Input from '../../../../components/Input';
import StepIndicator from '../../../../components/StepIndicator';
import { ArrowLeft, User, Hash, Building2, CreditCard } from 'lucide-react';
import api from '../../../../utils/api';
import useDriverAuthStore from '../../../../store/useDriverAuthStore';

const steps = ['Identity', 'Credentials', 'Bank', 'Safety', 'Training'];

const BankDetailsPage = () => {
  const navigate = useNavigate();
  const updateDriver = useDriverAuthStore((state) => state.updateDriver);
  const [form, setForm] = useState({ holder: '', account: '', ifsc: '', bank: '', upi: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get('/driver/profile');
        const data = res.data.data;
        if (data && data.bankDetails) {
          setForm({
            holder: data.bankDetails.accountHolderName || '',
            account: data.bankDetails.accountNumber || '',
            ifsc: data.bankDetails.ifscCode || '',
            bank: data.bankDetails.bankName || '',
            upi: data.bankDetails.upiId || ''
          });
        }
      } catch (error) {
        console.error('Failed to fetch profile', error);
      }
    };
    fetchProfile();
  }, []);

  const handleChange = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }));

  const handleContinue = async () => {
    try {
      setIsSubmitting(true);

      const stepData = {
        bankDetails: {
          accountHolderName: form.holder,
          accountNumber: form.account,
          ifscCode: form.ifsc,
          bankName: form.bank,
          upiId: form.upi,
        }
      };

      await api.put('/driver/onboarding/step', {
        stepNumber: 3,
        stepData
      });

      updateDriver({ onboardingStep: 4 });
      navigate('/driver/register/safety');
    } catch (error) {
      console.error('Failed to save step 3', error);
      alert('Failed to save bank details. Please try again.');
    } finally {
      setIsSubmitting(false);
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
          <h1 className="text-lg font-bold">Bank Details</h1>
          <span className="text-xs text-text-muted bg-bg px-2 py-1 rounded-full">3/5</span>
        </div>
        <StepIndicator steps={steps} currentStep={3} />
        <p className="text-xs text-text-muted mt-3">Payout routing setup</p>
      </div>
      <form className="flex-1 flex flex-col px-6 pb-8">
        <div className="flex-1 space-y-4 animate-fade-in-up">
          <Input label="Account holder name" placeholder="Name as in bank" value={form.holder} onChange={handleChange('holder')} icon={User} />
          <Input label="Account number" placeholder="Bank account number" value={form.account} onChange={handleChange('account')} icon={Hash} />
          <Input label="IFSC code" placeholder="HDFC0001234" value={form.ifsc} onChange={handleChange('ifsc')} icon={Building2} />
          <Input label="Bank name" placeholder="Bank name" value={form.bank} onChange={handleChange('bank')} icon={Building2} />
          <Input label="UPI ID (optional)" placeholder="user@upi" value={form.upi} onChange={handleChange('upi')} icon={CreditCard} />
        </div>
        <Button 
          fullWidth 
          onClick={handleContinue} 
          disabled={!form.holder || !form.account || !form.ifsc || !form.bank || isSubmitting}
          className="rounded-full py-4 text-base font-bold shadow-lg shadow-primary/20"
        >
          {isSubmitting ? 'SAVING...' : 'CONTINUE'}
        </Button>
      </form>
    </div>
  );
};

export default BankDetailsPage;
