import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../../../components/Button';
import StepIndicator from '../../../../components/StepIndicator';
import { CheckCircle2, Circle, Loader2, Shield } from 'lucide-react';
import api from '../../../../utils/api';
import useUserAuthStore from '../../../../store/useUserAuthStore';

const steps = ['Garage', 'Safety'];

const getConditionAnswer = (userConditions, conditionId) => {
  const match = userConditions?.find(
    (uc) => String(uc.conditionId?._id ?? uc.conditionId) === String(conditionId),
  );
  return match?.value ?? null;
};

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

  const toggleCondition = (id) => {
    setAnswers((prev) => ({
      ...prev,
      [id]: prev[id] === true ? false : true,
    }));
  };

  const requiredItems = useMemo(
    () => conditions.filter((c) => c.isRequired),
    [conditions],
  );

  const canSubmit = requiredItems.every((c) => answers[c._id] === true);
  const agreedCount = Object.values(answers).filter((v) => v === true).length;
  const requiredDone = requiredItems.filter((c) => answers[c._id] === true).length;

  const handleSubmit = async () => {
    if (!canSubmit) {
      alert('Please accept all required checklist items to continue.');
      return;
    }

    setSubmitting(true);
    try {
      const conditionPayload = conditions.map((c) => ({
        conditionId: c._id,
        value: answers[c._id] ?? null,
      }));

      const res = await api.put('/auth/onboarding/step', {
        stepData: { conditions: conditionPayload },
      });

      setAuth(res.data.data);
      navigate('/user/choose-service', { replace: true });
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
      <div className="bg-white px-4 pt-5 pb-6 shadow-sm border-b border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Step 2 of 2</span>
          <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
            {agreedCount}/{conditions.length} confirmed
            {requiredItems.length > 0 && ` · ${requiredDone}/${requiredItems.length} required`}
          </span>
        </div>
        <StepIndicator steps={steps} currentStep={2} />
        <div className="flex items-start gap-3 mt-5">
          <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center shrink-0">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Safety checklist</h1>
            <p className="text-sm text-slate-600 mt-1 leading-relaxed">
              Confirm each item so we can match you with the right driver and keep trips safe.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-3 overflow-y-auto pb-28">
        {conditions.map((item, idx) => {
          const checked = answers[item._id] === true;
          return (
            <button
              key={item._id}
              type="button"
              onClick={() => toggleCondition(item._id)}
              className={`w-full flex items-start gap-4 p-4 rounded-2xl border-2 transition-all text-left animate-fade-in-up
                ${checked
                  ? 'bg-white border-slate-900 shadow-md'
                  : 'bg-white border-slate-200 hover:border-slate-400'
                }`}
              style={{ animationDelay: `${idx * 0.05}s` }}
            >
              <div className={`shrink-0 mt-0.5 ${checked ? 'text-slate-900' : 'text-slate-300'}`}>
                {checked ? (
                  <CheckCircle2 className="w-7 h-7 fill-slate-900 text-primary" />
                ) : (
                  <Circle className="w-7 h-7" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={`text-sm font-semibold ${checked ? 'text-slate-900' : 'text-slate-700'}`}>
                    {item.question}
                  </p>
                  {item.isRequired && (
                    <span className="text-[10px] font-bold uppercase tracking-wide text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                      Required
                    </span>
                  )}
                </div>
                {item.description && (
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{item.description}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <ChecklistFooter submitting={submitting} canSubmit={canSubmit} onSubmit={handleSubmit} />
    </div>
  );
};

function ChecklistFooter({ submitting, canSubmit, onSubmit }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 shadow-[0_-8px_30px_rgba(0,0,0,0.06)] max-w-lg mx-auto">
      <Button
        fullWidth
        onClick={onSubmit}
        loading={submitting}
        disabled={!canSubmit || submitting}
        className="rounded-full py-4 text-base font-bold"
      >
        Complete registration
      </Button>
      {!canSubmit && (
        <p className="text-xs text-center text-amber-700 mt-2 font-medium">
          Accept all required items to continue
        </p>
      )}
      <p className="text-[10px] text-center text-slate-400 mt-3 uppercase tracking-wider font-semibold">
        Secure · Encrypted
      </p>
    </div>
  );
}

export default RegistrationChecklistPage;
