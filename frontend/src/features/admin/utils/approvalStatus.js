export const APPROVAL_STATUS_STYLES = {
  approved: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  pending: 'bg-amber-100 text-amber-700 border border-amber-200',
  rejected: 'bg-rose-100 text-rose-700 border border-rose-200',
  under_review: 'bg-blue-100 text-blue-700 border border-blue-200',
  suspended: 'bg-slate-100 text-slate-700 border border-slate-200',
};

export function getApprovalStatusStyles(status) {
  return APPROVAL_STATUS_STYLES[status] || 'bg-slate-100 text-slate-700 border border-slate-200';
}

export function formatApprovalStatus(status) {
  return status?.replace(/_/g, ' ') || 'unknown';
}

export const MIN_APPROVAL_NOTE_LENGTH = 10;

export function isApprovalNoteValid(note) {
  return (note || '').trim().length >= MIN_APPROVAL_NOTE_LENGTH;
}
