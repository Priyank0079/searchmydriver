import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../../../components/Button';
import StepIndicator from '../../../../components/StepIndicator';
import DocumentUploadField from '../../../../components/DocumentUploadField';
import { ArrowLeft } from 'lucide-react';
import api from '../../../../utils/api';
import useDriverAuthStore from '../../../../store/useDriverAuthStore';
import { useDocumentsManager } from '../../../../hooks/useDocumentsManager';

const steps = ['Identity', 'Credentials', 'Bank', 'Safety'];
const SAFETY_DOC_TYPES = ['aadhaar_front', 'aadhaar_back', 'police_verification'];

const SafetyProtocolPage = () => {
  const navigate = useNavigate();
  const updateDriver = useDriverAuthStore((state) => state.updateDriver);
  const [agreed, setAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    documents,
    loadFromApiDocuments,
    uploadDocument,
    isAnyUploading,
    allRequiredUploaded,
    toPayloadArray,
  } = useDocumentsManager(SAFETY_DOC_TYPES);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get('/driver/profile');
        const data = res.data.data;
        if (data?.safetyDeclaration?.agreed) setAgreed(true);
        if (data?.documents) loadFromApiDocuments(data.documents);
      } catch (error) {
        console.error('Failed to fetch profile', error);
      }
    };
    fetchProfile();
  }, [loadFromApiDocuments]);

  const handleSubmit = async () => {
    if (!allRequiredUploaded(SAFETY_DOC_TYPES)) {
      alert('Please upload all required documents');
      return;
    }

    try {
      setIsSubmitting(true);

      await api.put('/driver/onboarding/step', {
        stepNumber: 4,
        stepData: {
          safetyDeclaration: { agreed: true },
          documents: toPayloadArray(),
        },
      });

      await api.post('/driver/onboarding/submit');
      updateDriver({ onboardingStep: 4, approvalStatus: 'under_review' });
      navigate('/driver/register/approval');
    } catch (error) {
      console.error('Failed to submit application', error);
      alert(error.response?.data?.message || 'Failed to submit application. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitDisabled =
    !agreed || isAnyUploading || isSubmitting || !allRequiredUploaded(SAFETY_DOC_TYPES);

  return (
    <div className="flex-1 flex flex-col bg-white min-h-dvh">
      <div className="px-4 pt-4">
        <button type="button" onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>
      <div className="px-6 pt-2 pb-4">
        <PageHeader steps={steps} currentStep={4} title="Safety & Documents" />
      </div>
      <div className="flex-1 flex flex-col px-6 pb-8 overflow-y-auto">
        <div className="flex-1 space-y-6 animate-fade-in-up">
          <DocumentUploadField
            label="Aadhaar Card (Front)"
            doc={documents.aadhaar_front}
            onUpload={(file) => uploadDocument('aadhaar_front', file)}
            accept="image/*"
            disabled={isAnyUploading}
          />
          <DocumentUploadField
            label="Aadhaar Card (Back)"
            doc={documents.aadhaar_back}
            onUpload={(file) => uploadDocument('aadhaar_back', file)}
            accept="image/*"
            disabled={isAnyUploading}
          />
          <DocumentUploadField
            label="Police Verification Certificate"
            doc={documents.police_verification}
            onUpload={(file) => uploadDocument('police_verification', file)}
            accept="image/*"
            hint="JPG or PNG"
            disabled={isAnyUploading}
          />

          <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl bg-bg mt-4">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              disabled={isAnyUploading || isSubmitting}
              className="mt-0.5 w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <span className="text-xs text-text-secondary leading-relaxed">
              I declare that I have no criminal records and all submitted information is accurate and complete.
            </span>
          </label>
        </div>
        <div className="pt-6">
          <Button
            fullWidth
            loading={isSubmitting}
            disabled={submitDisabled}
            onClick={handleSubmit}
            className="rounded-full py-4 text-base font-bold shadow-lg shadow-primary/20"
          >
            {isAnyUploading ? 'UPLOADING...' : 'SUBMIT APPLICATION'}
          </Button>
        </div>
      </div>
    </div>
  );
};

function PageHeader({ steps, currentStep, title }) {
  return (
  <>
    <div className="flex items-center justify-between mb-4">
      <h1 className="text-lg font-bold">{title}</h1>
      <span className="text-xs text-text-muted bg-bg px-2 py-1 rounded-full">{currentStep}/4</span>
    </div>
    <StepIndicator steps={steps} currentStep={currentStep} />
    <p className="text-xs text-text-muted mt-3">Upload required documents (one file per type)</p>
  </>
  );
}

export default SafetyProtocolPage;
