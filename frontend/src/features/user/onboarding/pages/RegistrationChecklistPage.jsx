import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import api from '../../../../utils/api';
import useUserAuthStore from '../../../../store/useUserAuthStore';
import {
  getConditionAnswer,
  buildConditionPayload,
  isChecklistFormComplete,
  countChecklistProgress,
} from '../../../../utils/safetyChecklist';
import OnboardingPageHeader from '../components/OnboardingPageHeader';
import OnboardingStickyFooter from '../components/OnboardingStickyFooter';
import SafetyChecklistQuestion from '../components/SafetyChecklistQuestion';

const RegistrationChecklistPage = () => {
  const navigate = useNavigate();
  const { user, setAuth } = useUserAuthStore();
  const [conditions, setConditions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchConditions = async () => {
      try {
        const res = await api.get('/common/conditions?active=true');
        const data = res.data.data;
        setConditions(data);

        const initialAnswers = {};
        data.forEach((c) => {
          initialAnswers[c._id] = getConditionAnswer(user?.conditions, c._id);
        });
        setAnswers(initialAnswers);
      } catch (err) {
        console.error('Failed to fetch conditions', err);
      } finally {
        setLoading(false);
      }
    };
    fetchConditions();
  }, [user]);

  const setAnswer = (id, value) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  };

  const progress = useMemo(
    () => countChecklistProgress(conditions, answers),
    [conditions, answers],
  );

  const canSubmit = useMemo(
    () => isChecklistFormComplete(conditions, answers),
    [conditions, answers],
  );

  const submitHint = useMemo(() => {
    if (canSubmit || !conditions.length) return null;
    const { answered, total, requiredYes, requiredTotal } = progress;
    if (answered < total) {
      return `Answer all ${total} questions to continue (${answered}/${total} done)`;
    }
    if (requiredTotal > 0 && requiredYes < requiredTotal) {
      return `Required items must be answered Yes (${requiredYes}/${requiredTotal})`;
    }
    return 'Complete all required items to continue';
  }, [canSubmit, conditions.length, progress]);

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const res = await api.put('/auth/onboarding/step', {
        stepData: { conditions: buildConditionPayload(conditions, answers) },
      });

      setAuth(res.data.data);
      navigate('/user/home', { replace: true });
    } catch (err) {
      console.error('Failed to save checklist', err);
      alert(err.response?.data?.message || 'Failed to save your responses. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-white min-h-dvh">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-sm text-text-muted mt-4">Loading safety checklist...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-dvh">
      <OnboardingPageHeader
        title="Safety checklist"
        subtitle="Answer each question with Yes or No so we can match you with the right driver."
        onBack={() => navigate(-1)}
        badge={
          conditions.length > 0 ? (
            <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full shrink-0">
              {progress.answered}/{progress.total}
            </span>
          ) : null
        }
      />

      <div className="flex-1 p-4 space-y-4 overflow-y-auto pb-32">
        {conditions.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-12">No checklist questions configured.</p>
        ) : (
          conditions.map((item, idx) => (
            <SafetyChecklistQuestion
              key={item._id}
              index={idx + 1}
              question={item.question}
              description={item.description}
              isRequired={item.isRequired}
              value={answers[item._id] ?? null}
              onChange={(val) => setAnswer(item._id, val)}
              disabled={submitting}
            />
          ))
        )}
      </div>

      <OnboardingStickyFooter
        label="Complete registration"
        onClick={handleSubmit}
        loading={submitting}
        disabled={!canSubmit}
        hint={submitHint}
      />
    </div>
  );
};

export default RegistrationChecklistPage;
