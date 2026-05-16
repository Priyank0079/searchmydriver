import { useState } from 'react';
import Avatar from '../../../../components/Avatar';
import Button from '../../../../components/Button';
import AdminDetailModal from '../AdminDetailModal';
import StatusBadge from '../StatusBadge';
import DocumentGallery from '../DocumentGallery';
import ApprovalNoteForm, { isApprovalNoteValid } from '../ApprovalNoteForm';
import { CAR_EXPERIENCE_TYPES } from '../../../../utils/constants';

const REVIEWABLE_STATUSES = ['pending', 'under_review'];

function SectionCard({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-5">
      <h3 className="text-sm font-semibold text-slate-800 mb-4 tracking-wide">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function InfoItem({ label, value, capitalize = false }) {
  const displayValue = value && value !== 'N/A' ? value : '—';

  return (
    <div className="group">
      <p className="text-xs text-slate-400 mb-1.5 font-medium uppercase tracking-wider">{label}</p>
      <p className={`text-sm text-slate-700 ${capitalize ? 'capitalize' : ''} font-normal`}>
        {displayValue}
      </p>
    </div>
  );
}

function InfoGrid({ items, columns = 2 }) {
  return (
    <div className={`grid grid-cols-1 ${columns === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-1'} gap-5`}>
      {items.map((item, idx) => (
        <InfoItem key={idx} {...item} />
      ))}
    </div>
  );
}

const DriverReviewModal = ({
  selectedDriver,
  onClose,
  approvalNote,
  onNoteChange,
  onUpdateStatus,
}) => {
  const [noteError, setNoteError] = useState('');
  const [submitting, setSubmitting] = useState(null);

  if (!selectedDriver) return null;

  const selfie = selectedDriver.documents?.find((d) => d.type === 'selfie')?.fileUrl;
  const canReview = REVIEWABLE_STATUSES.includes(selectedDriver.approvalStatus);

  const formatDate = (date) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatAvailability = (availability) => {
    if (!availability) return '—';
    return availability.replace(/-/g, ' ');
  };

  const headerExtra = (
    <div className="flex flex-col sm:flex-row sm:items-center gap-5">
      <Avatar
        name={selectedDriver.name}
        size="lg"
        src={selfie}
        className="ring-2 ring-white shadow-md"
      />
      <div className="flex-1 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
          <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight">
            {selectedDriver.name}
          </h2>
          <StatusBadge status={selectedDriver.approvalStatus} />
        </div>
        <ContactRow phone={selectedDriver.phone} email={selectedDriver.email} />
      </div>
    </div>
  );

  const handleAction = async (status) => {
    if (!isApprovalNoteValid(approvalNote)) {
      setNoteError('Please provide a brief explanation (minimum 10 characters)');
      return;
    }
    setNoteError('');
    setSubmitting(status);
    try {
      await onUpdateStatus(status);
    } finally {
      setSubmitting(null);
    }
  };

  const footer = canReview ? (
    <div className="flex flex-col sm:flex-row gap-3">
      <Button
        variant="primary"
        fullWidth
        className="h-10 text-sm font-medium rounded-lg shadow-sm hover:shadow transition-shadow"
        loading={submitting === 'approved'}
        disabled={Boolean(submitting)}
        onClick={() => handleAction('approved')}
      >
        Approve Driver
      </Button>
      <Button
        fullWidth
        className="h-10 rounded-lg bg-white border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 hover:border-red-300 transition-all"
        loading={submitting === 'rejected'}
        disabled={Boolean(submitting)}
        onClick={() => handleAction('rejected')}
      >
        Reject Driver
      </Button>
    </div>
  ) : (
    <Button
      fullWidth
      variant="outline"
      className="h-10 rounded-lg text-sm font-medium"
      onClick={onClose}
    >
      Close
    </Button>
  );

  return (
    <AdminDetailModal
      isOpen={!!selectedDriver}
      onClose={onClose}
      headerExtra={headerExtra}
      footer={footer}
    >
      <div className="space-y-6">
        {/* Previous review note */}
        {selectedDriver.approvalNote && !canReview && (
          <SectionCard title="Previous Review">
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                {selectedDriver.approvalNote}
              </p>
            </div>
          </SectionCard>
        )}

        {/* Driver Information */}
        <SectionCard title="Driver Information">
          <InfoGrid
            items={[
              { label: 'Experience', value: `${selectedDriver.experienceYears || 0} years` },
              {
                label: 'Availability',
                value: formatAvailability(selectedDriver.availability),
                capitalize: true
              },
            ]}
          />

          {/* Vehicle Experience */}
          {selectedDriver.carTypeExperience?.length > 0 && (
            <div className="mt-5 pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-400 mb-3 font-medium uppercase tracking-wider">
                Vehicle Experience
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedDriver.carTypeExperience.map((typeId) => {
                  const car = CAR_EXPERIENCE_TYPES.find((c) => c.id === typeId);
                  return car ? (
                    <span
                      key={typeId}
                      className="inline-flex items-center px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100 text-xs text-slate-600"
                    >
                      <span>{car.label}</span>
                    </span>
                  ) : null;
                })}
              </div>
            </div>
          )}
        </SectionCard>

        {/* Driving Credentials */}
        <SectionCard title="Driving Credentials">
          <InfoGrid
            items={[
              { label: 'License Number', value: selectedDriver.drivingLicense?.number || '—' },
              {
                label: 'Expiry Date',
                value: selectedDriver.drivingLicense?.expiryDate
                  ? formatDate(selectedDriver.drivingLicense.expiryDate)
                  : '—'
              },
            ]}
          />
        </SectionCard>

        {/* Bank Details */}
        {selectedDriver.bankDetails && (
          <SectionCard title="Bank Details">
            <InfoGrid
              columns={2}
              items={[
                { label: 'Account Holder', value: selectedDriver.bankDetails.accountHolderName || '—' },
                { label: 'Account Number', value: selectedDriver.bankDetails.accountNumber || '—' },
                { label: 'IFSC Code', value: selectedDriver.bankDetails.ifscCode || '—' },
                { label: 'Bank Name', value: selectedDriver.bankDetails.bankName || '—' },
              ]}
            />
          </SectionCard>
        )}

        {/* Documents */}
        <SectionCard title="Documents">
          <DocumentGallery documents={selectedDriver.documents} />
        </SectionCard>

        {/* Approval Form */}
        {canReview && (
          <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
            <ApprovalNoteForm
              value={approvalNote}
              onChange={(val) => {
                onNoteChange(val);
                if (noteError && isApprovalNoteValid(val)) setNoteError('');
              }}
              error={noteError}
            />
          </div>
        )}
      </div>
    </AdminDetailModal>
  );
};

function ContactRow({ phone, email }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-sm">
      <span className="text-slate-500 font-mono">{phone}</span>
      <span className="hidden sm:inline text-slate-300">•</span>
      <span className="text-slate-500 truncate">
        {email ? (
          <a href={`mailto:${email}`} className="hover:text-slate-700 transition-colors">
            {email}
          </a>
        ) : 'No email provided'}
      </span>
    </div>
  );
}

export default DriverReviewModal;


// import { useState } from 'react';
// import Avatar from '../../../../components/Avatar';
// import Button from '../../../../components/Button';
// import AdminDetailModal from '../AdminDetailModal';
// import StatusBadge from '../StatusBadge';
// import DocumentGallery from '../DocumentGallery';
// import ApprovalNoteForm, { isApprovalNoteValid } from '../ApprovalNoteForm';
// import { CAR_EXPERIENCE_TYPES } from '../../../../utils/constants';

// const REVIEWABLE_STATUSES = ['pending', 'under_review'];

// function SectionCard({ title, children }) {
//   return (
//     <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
//       <h3 className="text-sm font-semibold text-slate-900 mb-4">{title}</h3>
//       {children}
//     </div>
//   );
// }

// function InfoItem({ label, value, capitalize = false }) {
//   return (
//     <div>
//       <p className="text-xs text-slate-500 mb-1">{label}</p>
//       <p className={`text-sm font-medium text-slate-800 ${capitalize ? 'capitalize' : ''}`}>{value}</p>
//     </div>
//   );
// }

// const DriverReviewModal = ({
//   selectedDriver,
//   onClose,
//   approvalNote,
//   onNoteChange,
//   onUpdateStatus,
// }) => {
//   const [noteError, setNoteError] = useState('');
//   const [submitting, setSubmitting] = useState(null);

//   if (!selectedDriver) return null;

//   const selfie = selectedDriver.documents?.find((d) => d.type === 'selfie')?.fileUrl;
//   const canReview = REVIEWABLE_STATUSES.includes(selectedDriver.approvalStatus);

//   const headerExtra = (
//     <div className="flex flex-col sm:flex-row sm:items-center gap-4">
//       <Avatar name={selectedDriver.name} size="lg" src={selfie} className="ring-2 ring-slate-100 shadow-sm" />
//       <div className="flex-1 min-w-0">
//         <div className="flex flex-col sm:flex-row sm:items-center gap-2">
//           <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 truncate">{selectedDriver.name}</h2>
//           <StatusBadge status={selectedDriver.approvalStatus} />
//         </div>
//         <ContactRow phone={selectedDriver.phone} email={selectedDriver.email} />
//       </div>
//     </div>
//   );

//   const handleAction = async (status) => {
//     if (!isApprovalNoteValid(approvalNote)) {
//       setNoteError('Please enter at least 10 characters explaining your decision.');
//       return;
//     }
//     setNoteError('');
//     setSubmitting(status);
//     try {
//       await onUpdateStatus(status);
//     } finally {
//       setSubmitting(null);
//     }
//   };

//   const footer = canReview ? (
//     <div className="flex flex-col sm:flex-row gap-3">
//       <Button
//         variant="primary"
//         fullWidth
//         className="h-11 text-sm font-medium rounded-xl"
//         loading={submitting === 'approved'}
//         disabled={Boolean(submitting)}
//         onClick={() => handleAction('approved')}
//       >
//         Approve driver
//       </Button>
//       <Button
//         fullWidth
//         className="h-11 rounded-xl bg-danger hover:bg-danger-dark text-white text-sm font-medium"
//         loading={submitting === 'rejected'}
//         disabled={Boolean(submitting)}
//         onClick={() => handleAction('rejected')}
//       >
//         Reject driver
//       </Button>
//     </div>
//   ) : (
//     <Button fullWidth variant="outline" className="h-11 rounded-xl text-sm" onClick={onClose}>
//       Close
//     </Button>
//   );

//   return (
//     <AdminDetailModal isOpen={!!selectedDriver} onClose={onClose} headerExtra={headerExtra} footer={footer}>
//       <div className="space-y-5">
//         {selectedDriver.approvalNote && !canReview && (
//           <SectionCard title="Previous review note">
//             <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedDriver.approvalNote}</p>
//           </SectionCard>
//         )}

//         <SectionCard title="Driver information">
//           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//             <InfoItem label="Experience" value={`${selectedDriver.experienceYears || 0} years`} />
//             <InfoItem
//               label="Availability"
//               value={selectedDriver.availability?.replace(/-/g, ' ') || 'N/A'}
//               capitalize
//             />
//             <div className="sm:col-span-2">
//               <p className="text-xs text-slate-500 mb-2">Vehicle experience</p>
//               <div className="flex flex-wrap gap-2">
//                 {selectedDriver.carTypeExperience?.map((typeId) => {
//                   const car = CAR_EXPERIENCE_TYPES.find((c) => c.id === typeId);
//                   return car ? (
//                     <span
//                       key={typeId}
//                       className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 text-xs text-slate-700"
//                     >
//                       {car.icon} {car.label}
//                     </span>
//                   ) : null;
//                 })}
//               </div>
//             </div>
//           </div>
//         </SectionCard>

//         <SectionCard title="Driving credentials">
//           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//             <InfoItem label="License number" value={selectedDriver.drivingLicense?.number || 'N/A'} />
//             <InfoItem
//               label="Expiry date"
//               value={
//                 selectedDriver.drivingLicense?.expiryDate
//                   ? new Date(selectedDriver.drivingLicense.expiryDate).toLocaleDateString()
//                   : 'N/A'
//               }
//             />
//           </div>
//         </SectionCard>

//         {selectedDriver.bankDetails && (
//           <SectionCard title="Bank details">
//             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//               <InfoItem label="Account holder" value={selectedDriver.bankDetails.accountHolderName || 'N/A'} />
//               <InfoItem label="Account number" value={selectedDriver.bankDetails.accountNumber || 'N/A'} />
//               <InfoItem label="IFSC" value={selectedDriver.bankDetails.ifscCode || 'N/A'} />
//               <InfoItem label="Bank name" value={selectedDriver.bankDetails.bankName || 'N/A'} />
//             </div>
//           </SectionCard>
//         )}

//         <SectionCard title="Documents">
//           <DocumentGallery documents={selectedDriver.documents} />
//         </SectionCard>

//         {canReview && (
//           <ApprovalNoteForm
//             value={approvalNote}
//             onChange={(val) => {
//               onNoteChange(val);
//               if (noteError && isApprovalNoteValid(val)) setNoteError('');
//             }}
//             error={noteError}
//           />
//         )}
//       </div>
//     </AdminDetailModal>
//   );
// };

// function ContactRow({ phone, email }) {
//   return (
//     <div className="flex flex-col sm:flex-row gap-1 sm:gap-4 mt-2 text-sm text-slate-500">
//       <span>{phone}</span>
//       <span className="hidden sm:block">•</span>
//       <span className="truncate">{email || 'No email provided'}</span>
//     </div>
//   );
// }

// export default DriverReviewModal;
