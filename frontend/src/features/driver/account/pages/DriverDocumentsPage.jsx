import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, CheckCircle2, Clock3, FileText, Image as ImageIcon, ShieldAlert } from 'lucide-react';
import Card from '../../../../components/Card';
import DriverScreenShell from '../../components/DriverScreenShell';
import { useDriverProfileStore } from '../../../../store/driver/useDriverProfileStore';
import { useCachedQuery } from '../../../../hooks/useCachedQuery';
import { buildCacheKey } from '../../../../store/lib/buildCacheKey';
import useDriverAuthStore from '../../../../store/useDriverAuthStore';
import { dedupeDocumentsForDisplay, DOCUMENT_LABELS } from '../../../../utils/documents';
import { formatDate } from '../../../../utils/formatters';

const STATUS_META = {
  pending: { label: 'Pending', className: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock3 },
  verified: { label: 'Verified', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  rejected: { label: 'Rejected', className: 'bg-rose-50 text-rose-700 border-rose-200', icon: ShieldAlert },
};

const DriverDocumentsPage = () => {
  const navigate = useNavigate();
  const cachedDriver = useDriverAuthStore((s) => s.driver);
  const updateDriver = useDriverAuthStore((s) => s.updateDriver);
  const profileKey = buildCacheKey('driver-profile', {});
  const { data: profile, loading, error, refetch } = useCachedQuery(useDriverProfileStore, profileKey, {});

  useEffect(() => {
    if (!profile) return;
    updateDriver({
      name: profile.name,
      phone: profile.phone,
      email: profile.email,
      profilePicture: profile.profilePicture,
      approvalStatus: profile.approvalStatus,
      isOnline: profile.isOnline,
      canGoOnline: profile.canGoOnline,
    });
  }, [profile, updateDriver]);

  useEffect(() => {
    refetch().catch(() => {});
  }, [refetch]);

  const driver = profile || cachedDriver || {};
  const documents = dedupeDocumentsForDisplay(driver.documents || []);

  if (loading && !profile) {
    return (
      <DriverScreenShell>
        <div className="flex items-center justify-center min-h-full text-text-muted">Loading documents...</div>
      </DriverScreenShell>
    );
  }

  if (error && !profile) {
    return (
      <DriverScreenShell>
        <div className="p-4 space-y-4">
          <button
            type="button"
            onClick={() => navigate('/driver/account')}
            className="inline-flex items-center gap-2 text-sm font-semibold text-text-secondary"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error || 'Failed to load documents'}
          </div>
        </div>
      </DriverScreenShell>
    );
  }

  return (
    <DriverScreenShell
      header={(
        <header className="bg-dark px-4 pt-5 pb-5 rounded-b-3xl text-white">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/driver/account')}
              className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white/80 shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-white/60 uppercase tracking-[0.25em]">Documents</p>
              <h1 className="text-base font-bold">Uploaded documents</h1>
              <p className="text-xs text-white/70 mt-0.5">View every uploaded file and its review status.</p>
            </div>
          </div>
        </header>
      )}
      bodyClassName="p-4 -mt-3 pb-8 space-y-4"
    >
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-text">
          <FileText className="w-4 h-4 text-primary" />
          All uploads
        </div>
        <p className="text-sm text-text-secondary">Tap a card to open the file in a new tab.</p>
      </Card>

      {documents.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {documents.map((doc) => {
            const meta = STATUS_META[doc.verificationStatus] || STATUS_META.pending;
            const StatusIcon = meta.icon;
            return (
              <Card key={doc._id || doc.type} padding="p-0" className="overflow-hidden">
                <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="block">
                  <div className="aspect-[16/10] bg-slate-100 overflow-hidden">
                    <img src={doc.fileUrl} alt={DOCUMENT_LABELS[doc.type] || doc.type} className="w-full h-full object-cover" />
                  </div>
                </a>
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-text">{DOCUMENT_LABELS[doc.type] || doc.type.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-text-muted mt-1">Uploaded {formatDate(doc.uploadedAt)}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${meta.className}`}>
                      <StatusIcon className="w-3.5 h-3.5" />
                      {meta.label}
                    </span>
                  </div>

                  {doc.rejectionReason && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                      {doc.rejectionReason}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <Info label="Document" value={DOCUMENT_LABELS[doc.type] || doc.type.replace(/_/g, ' ')} icon={ImageIcon} />
                    <Info label="Verified at" value={doc.verifiedAt ? formatDate(doc.verifiedAt) : '�'} icon={Calendar} />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-6 text-center space-y-2">
          <p className="text-sm font-semibold text-text">No documents uploaded</p>
          <p className="text-sm text-text-secondary">Your uploaded driver documents will appear here once they are added to your profile.</p>
        </Card>
      )}
    </DriverScreenShell>
  );
};

function Info({ label, value, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-border-light bg-bg px-3 py-3">
      <div className="flex items-center gap-2 text-text-muted text-xs uppercase tracking-wide mb-1">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <p className="text-sm font-semibold text-text break-words">{value}</p>
    </div>
  );
}

export default DriverDocumentsPage;
