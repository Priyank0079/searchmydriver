import { MIN_APPROVAL_NOTE_LENGTH, isApprovalNoteValid } from '../utils/approvalStatus';

const ApprovalNoteForm = ({ value, onChange, error }) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
    <h3 className="text-sm font-semibold text-slate-900 mb-1">Review notes</h3>
    <p className="text-xs text-slate-500 mb-4">
      Required when approving or rejecting (min {MIN_APPROVAL_NOTE_LENGTH} characters).
    </p>
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Explain your decision for internal records and driver communication..."
      className={`w-full h-28 rounded-xl border bg-slate-50 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all
        ${error ? 'border-rose-300 focus:border-rose-400' : 'border-slate-200 focus:border-primary'}
      `}
    />
    {error ? (
      <p className="text-xs text-rose-600 mt-2">{error}</p>
    ) : (
      <p className="text-[11px] text-slate-400 mt-2">
        {value.trim().length}/{MIN_APPROVAL_NOTE_LENGTH} characters minimum
      </p>
    )}
  </div>
);

export { isApprovalNoteValid };
export default ApprovalNoteForm;
