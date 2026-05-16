import { useNavigate } from 'react-router-dom';
import Button from '../../../../components/Button';
import { Clock, XCircle } from 'lucide-react';
import useDriverAuthStore from '../../../../store/useDriverAuthStore';

const ProfileUnderReviewPage = () => {
  const navigate = useNavigate();
  const { driver, logout } = useDriverAuthStore();
  const isRejected = driver?.approvalStatus === 'rejected';

  const handleLogout = () => {
    logout();
    navigate('/driver/login');
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-white min-h-dvh px-8">
      <div className="animate-bounce-in mb-6">
        <div className={`w-24 h-24 ${isRejected ? 'bg-danger/10' : 'bg-primary/10'} rounded-full flex items-center justify-center`}>
          {isRejected ? (
            <XCircle className="w-12 h-12 text-danger" />
          ) : (
            <Clock className="w-12 h-12 text-primary" />
          )}
        </div>
      </div>
      
      <h1 className={`text-2xl font-bold text-text mb-2 animate-fade-in-up text-center`}>
        {isRejected ? 'Application Rejected' : 'Profile Under Review'}
      </h1>
      
      <div className="text-sm text-text-secondary text-center mb-8 animate-fade-in-up space-y-4" style={{ animationDelay: '0.15s' }}>
        {isRejected ? (
          <>
            <p>We're sorry, but your application has been rejected for the following reason:</p>
            <div className="p-4 bg-danger/5 border border-danger/10 rounded-2xl text-danger font-medium italic">
              "{driver.approvalNote || 'No specific reason provided.'}"
            </div>
            <p className="text-xs">Please contact support for more details or to re-apply.</p>
          </>
        ) : (
          <p>
            Your application has been submitted successfully. Our team will verify your details and get back to you soon.
          </p>
        )}
      </div>
      <div className="w-full animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
        <Button fullWidth variant="outline" onClick={handleLogout}>Log Out</Button>
      </div>
    </div>
  );
};

export default ProfileUnderReviewPage;
