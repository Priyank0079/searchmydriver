import Card from '../../../../components/Card';
import YesNoChoice from '../../../../components/YesNoChoice';

const SafetyChecklistQuestion = ({
  index,
  question,
  description,
  isRequired,
  value,
  onChange,
  disabled = false,
}) => {
  const answered = value === true || value === false;
  const needsYes = isRequired && value === false;

  return (
    <Card className="border border-slate-100 shadow-sm space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Question {index}
          </span>
          {isRequired && (
            <span className="text-[10px] font-bold uppercase tracking-wide text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
              Required
            </span>
          )}
        </div>
        <p className="text-[15px] font-semibold text-slate-900 leading-snug">{question}</p>
        {description && (
          <p className="text-sm text-slate-500 mt-2 leading-relaxed">{description}</p>
        )}
      </div>

      <YesNoChoice value={value} onChange={onChange} disabled={disabled} />

      {!answered && (
        <p className="text-xs text-slate-400">Select Yes or No to continue</p>
      )}
      {needsYes && (
        <p className="text-xs text-rose-600 font-medium">
          This item is required — select Yes to proceed with registration.
        </p>
      )}
    </Card>
  );
};

export default SafetyChecklistQuestion;
