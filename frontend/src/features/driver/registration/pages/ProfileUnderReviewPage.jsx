import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Clock, XCircle, RefreshCw, LogOut } from 'lucide-react';
import Button from '../../../../components/Button';
import api from '../../../../utils/api';
import useDriverAuthStore from '../../../../store/useDriverAuthStore';
import { canUpdateRejectedApplication } from '../../../../utils/driverOnboarding';

const ProfileUnderReviewPage = () => {
  const navigate = useNavigate();
  const { driver, updateDriver, logout } = useDriverAuthStore();
  const [reopening, setReopening] = useState(false);

  const isRejected = canUpdateRejectedApplication(driver);
  const isUnderReview = driver?.approvalStatus === 'under_review';

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await api.get('/driver/profile');
        const profile = res.data.data;
        updateDriver({
          approvalStatus: profile.approvalStatus,
          approvalNote: profile.approvalNote || '',
          onboardingStep: profile.onboardingStep,
        });
      } catch (err) {
        console.error('Failed to load application status', err);
      }
    };
    loadProfile();
  }, [updateDriver]);

  const handleLogout = () => {
    logout();
    navigate('/driver/login');
  };

  const handleUpdateApplication = async () => {
    setReopening(true);
    try {
      const res = await api.post('/driver/application/reopen');
      const data = res.data.data;
      updateDriver({
        approvalStatus: data.approvalStatus,
        onboardingStep: data.onboardingStep,
        approvalNote: '',
        liveVerificationVideo: data.liveVerificationVideo,
      });
      toast.success('You can update your application now');
      navigate('/driver/register/safety', { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not reopen application');
    } finally {
      setReopening(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 min-h-dvh px-6 py-10">
      <div
        className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${
          isRejected ? 'bg-rose-100' : 'bg-primary/15'
        }`}
      >
        {isRejected ? (
          <XCircle className="w-10 h-10 text-rose-600" />
        ) : (
          <Clock className="w-10 h-10 text-primary" />
        )}
      </div>

      <h1 className="text-2xl font-bold text-slate-900 mb-2 text-center">
        {isRejected ? 'Application rejected' : 'Profile under review'}
      </h1>

      <div className="w-full max-w-md text-center space-y-4 mb-8">
        {isRejected ? (
          <>
            <p className="text-sm text-slate-600 leading-relaxed">
              Your application was not approved. Review the note below, update your details, and
              submit again.
            </p>
            <div className="p-4 bg-white border border-rose-200 rounded-2xl text-left">
              <p className="text-xs font-semibold text-rose-700 uppercase tracking-wide mb-2">
                Reason
              </p>
              <p className="text-sm text-slate-800 leading-relaxed">
                {driver?.approvalNote || 'No specific reason was provided.'}
              </p>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-600 leading-relaxed">
            {isUnderReview
              ? 'Your application has been submitted. Our team is verifying your documents and live video.'
              : 'Thank you for registering. We will notify you once verification is complete.'}
          </p>
        )}
      </div>

      <div className="w-full max-w-md space-y-3">
        {isRejected && (
          <Button
            fullWidth
            loading={reopening}
            onClick={handleUpdateApplication}
            className="rounded-full py-4"
          >
            <RefreshCw className="w-4 h-4 mr-2 inline" />
            Update my application
          </Button>
        )}
        <Button
          fullWidth
          variant="outline"
          onClick={handleLogout}
          className="rounded-full py-4 border-slate-300 text-slate-800"
        >
          <LogOut className="w-4 h-4 mr-2 inline" />
          Log out
        </Button>
      </div>
    </div>
  );
};

export default ProfileUnderReviewPage;
