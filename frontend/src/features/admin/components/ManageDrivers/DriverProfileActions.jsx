import { useState } from 'react';
import Button from '../../../../components/Button';
import ApprovalNoteForm, { isApprovalNoteValid } from '../ApprovalNoteForm';
import api from '../../../../utils/api';

const REVIEWABLE = ['pending', 'under_review'];

const DriverProfileActions = ({ driver, onSuccess }) => {
  const [approvalNote, setApprovalNote] = useState(driver?.approvalNote || '');
  const [noteError, setNoteError] = useState('');
  const [actionError, setActionError] = useState('');
  const [submitting, setSubmitting] = useState(null);

  if (!driver) return null;

  const canReview = REVIEWABLE.includes(driver.approvalStatus);
  const canDeactivate = driver.approvalStatus === 'approved';

  const runAction = async (approvalStatus) => {
    const needsNote = ['approved', 'rejected'].includes(approvalStatus);
    if (needsNote && !isApprovalNoteValid(approvalNote)) {
      setNoteError('Please provide a brief explanation (minimum 10 characters).');
      return;
    }

    setNoteError('');
    setActionError('');
    setSubmitting(approvalStatus);

    try {
      await api.put(`/admin/drivers/${driver._id}/status`, {
        approvalStatus,
        approvalNote: approvalNote.trim(),
      });
      onSuccess?.();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to update driver status');
    } finally {
      setSubmitting(null);
    }
  };

  if (!canReview && !canDeactivate) {
    return driver.approvalNote ? (
      <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Review note</p>
        <p className="text-sm text-slate-700 whitespace-pre-wrap">{driver.approvalNote}</p>
      </div>
    ) : null;
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
      <h2 className="text-sm font-semibold text-slate-800">Driver actions</h2>

      {actionError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {actionError}
        </div>
      )}

      {canReview && (
        <ApprovalNoteForm
          value={approvalNote}
          onChange={(val) => {
            setApprovalNote(val);
            if (noteError && isApprovalNoteValid(val)) setNoteError('');
          }}
          error={noteError}
        />
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        {canReview && (
          <>
            <Button
              variant="primary"
              fullWidth
              className="h-11 rounded-xl text-sm font-semibold"
              loading={submitting === 'approved'}
              disabled={Boolean(submitting)}
              onClick={() => runAction('approved')}
            >
              Approve driver
            </Button>
            <Button
              fullWidth
              className="h-11 rounded-xl bg-white border border-rose-200 text-rose-600 text-sm font-semibold hover:bg-rose-50"
              loading={submitting === 'rejected'}
              disabled={Boolean(submitting)}
              onClick={() => runAction('rejected')}
            >
              Reject driver
            </Button>
          </>
        )}
        {canDeactivate && (
          <Button
            fullWidth
            variant="outline"
            className="h-11 rounded-xl border-amber-200 text-amber-800 hover:bg-amber-50 text-sm font-semibold"
            loading={submitting === 'suspended'}
            disabled={Boolean(submitting)}
            onClick={() => {
              if (!window.confirm('Deactivate this driver? They will not be able to use the app.')) return;
              runAction('suspended');
            }}
          >
            Deactivate driver
          </Button>
        )}
      </div>
    </div>
  );
};

export default DriverProfileActions;
