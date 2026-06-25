import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../../../components/Button';
import LiveVideoRecorder from '../../../../components/LiveVideoRecorder';
import DriverOnboardingShell from '../components/DriverOnboardingShell';
import LiveVerificationInstructions from '../components/LiveVerificationInstructions';
import SavedVerificationVideo from '../components/SavedVerificationVideo';
import useLiveVerification from '../../../../hooks/useLiveVerification';
import useDriverAuthStore from '../../../../store/useDriverAuthStore';
import { LIVE_VERIFICATION_MIN_SECONDS } from '../../../../utils/driverOnboarding';
import api from '../../../../utils/api';

const LiveVerificationPage = () => {
  const navigate = useNavigate();
  const updateDriver = useDriverAuthStore((s) => s.updateDriver);
  const [isSkipping, setIsSkipping] = useState(false);

  const {
    savedVideo,
    loading,
    uploading,
    recordedBlob,
    recordedSeconds,
    recorderKey,
    showRecorder,
    fetchSavedVideo,
    handleRecordingComplete,
    startRerecord,
    uploadRecording,
  } = useLiveVerification({
    onSuccess: (data) => {
      updateDriver({
        onboardingStep: data.onboardingStep,
        liveVerificationVideo: data.liveVerificationVideo,
      });
    },
  });

  useEffect(() => {
    fetchSavedVideo();
  }, [fetchSavedVideo]);

  const handleContinue = () => {
    navigate('/driver/register/training', { replace: true });
  };

  const handleSubmit = async () => {
    const ok = await uploadRecording();
    if (ok) await fetchSavedVideo();
  };

  const handleSkip = async () => {
    try {
      setIsSkipping(true);
      await api.put('/driver/onboarding/step', { stepNumber: 5 });
      updateDriver({ onboardingStep: 5 });
      handleContinue();
    } catch (err) {
      console.error('Failed to skip verification', err);
      alert('Failed to skip. Please try again.');
    } finally {
      setIsSkipping(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-dvh bg-slate-50">
        <p className="text-sm text-slate-600">Loading…</p>
      </div>
    );
  }

  return (
    <DriverOnboardingShell
      currentStep={5}
      stepLabel="5/6"
      title="Live identity verification"
      subtitle="Record a live video showing your Aadhaar and driving licence. No gallery uploads."
      onBack={() => navigate(-1)}
      footer={
        showRecorder ? (
          <div className="flex flex-col gap-3">
            <Button
              fullWidth
              loading={uploading}
              disabled={!recordedBlob || recordedSeconds < LIVE_VERIFICATION_MIN_SECONDS || isSkipping}
              onClick={handleSubmit}
              className="rounded-full py-4 text-base font-bold"
            >
              Submit verification video
            </Button>
            <Button
              fullWidth
              variant="outline"
              loading={isSkipping}
              disabled={uploading}
              onClick={handleSkip}
              className="rounded-full py-4 text-base font-semibold"
            >
              Skip for now
            </Button>
          </div>
        ) : null
      }
    >
      {showRecorder ? (
        <>
          <LiveVerificationInstructions />
          <LiveVideoRecorder
            key={recorderKey}
            onRecordingComplete={handleRecordingComplete}
            disabled={uploading}
          />
        </>
      ) : (
        <SavedVerificationVideo
          video={savedVideo}
          onRerecord={startRerecord}
          onContinue={handleContinue}
        />
      )}
    </DriverOnboardingShell>
  );
};

export default LiveVerificationPage;
