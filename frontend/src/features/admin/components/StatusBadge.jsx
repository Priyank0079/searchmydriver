import { getApprovalStatusStyles, formatApprovalStatus } from '../utils/approvalStatus';

const StatusBadge = ({ status, className = '' }) => (
  <span
    className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium capitalize tracking-wide ${getApprovalStatusStyles(status)} ${className}`}
  >
    {formatApprovalStatus(status)}
  </span>
);

export default StatusBadge;
