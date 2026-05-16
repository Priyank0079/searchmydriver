import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Car, CheckCircle2, Circle, Loader2, Mail, Phone, RefreshCw } from 'lucide-react';
import Avatar from '../../../components/Avatar';
import { useCachedQuery } from '../../../hooks/useCachedQuery';
import { buildCacheKey } from '../../../store/lib/buildCacheKey';
import { useAdminUserProfileStore } from '../../../store/admin/useAdminUserProfileStore';
import { SectionCard, InfoGrid } from '../components/DetailBlocks';

const formatDate = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const UserProfilePage = () => {
  const { userId } = useParams();

  const queryParams = useMemo(() => ({ userId }), [userId]);
  const cacheKey = buildCacheKey('user-profile', queryParams);

  const { data: profile, loading, error, refetch } = useCachedQuery(
    useAdminUserProfileStore,
    cacheKey,
    queryParams,
    { enabled: Boolean(userId) },
  );

  if (loading && !profile) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-sm text-slate-500">Loading profile...</p>
      </div>
    );
  }

  if (error || !profile?.user) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error || 'User not found'}</div>
      </div>
    );
  }

  const { user, cars, checklist, hasChecklist, carsCount } = profile;

  return (
    <div className="space-y-6 animate-fade-in-up pb-8">
      <div className="flex items-center justify-between gap-4">
        <BackLink />
        <button
          type="button"
          onClick={() => refetch()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <Avatar name={user.name} size="lg" src={user.profilePicture} className="ring-2 ring-white shadow-md" />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-slate-900">{user.name}</h1>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${user.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                {user.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-slate-600">
              <span className="inline-flex items-center gap-1.5"><Phone className="w-4 h-4" />{user.phone_no}</span>
              <span className="inline-flex items-center gap-1.5"><Mail className="w-4 h-4" />{user.email}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Account details">
          <InfoGrid
            items={[
              { label: 'User ID', value: user._id },
              { label: 'Joined', value: formatDate(user.createdAt) },
              { label: 'Phone verified', value: user.isPhoneVerified ? 'Yes' : 'No' },
              { label: 'Email verified', value: user.isEmailVerified ? 'Yes' : 'No' },
              { label: 'Vehicles', value: String(carsCount) },
              { label: 'Safety checklist', value: hasChecklist ? 'Complete' : 'Incomplete' },
            ]}
          />
        </SectionCard>

        <SectionCard title="Safety checklist">
          {!checklist?.length ? (
            <p className="text-sm text-slate-500">No checklist items configured.</p>
          ) : (
            <ul className="space-y-3">
              {checklist.map((item) => {
                const accepted = item.value === true;
                return (
                  <li key={item._id} className="flex items-start gap-3 text-sm">
                    {accepted ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-300 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-medium text-slate-800">{item.question}</p>
                      {item.isRequired && (
                        <span className="text-[10px] font-bold uppercase text-rose-600">Required</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard title={`Registered vehicles (${cars?.length || 0})`}>
        {!cars?.length ? (
          <p className="text-sm text-slate-500">No vehicles registered.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cars.map((car) => (
              <div key={car._id} className="flex gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50">
                <div className="w-20 h-20 rounded-xl overflow-hidden bg-white border border-slate-200 shrink-0">
                  {car.image ? (
                    <img src={car.image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Car className="w-8 h-8 text-slate-300" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-900">{car.brand} {car.model}</p>
                  <p className="text-xs font-mono font-semibold text-slate-700 mt-1 uppercase">{car.vehicleNumber}</p>
                  <InfoGrid
                    columns={1}
                    items={[
                      { label: 'Category', value: car.carTypeId?.name },
                      { label: 'Fuel / Transmission', value: `${car.fuelType} · ${car.transmission}`, capitalize: true },
                    ]}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
};

function BackLink() {
  return (
    <Link
      to="/admin/users"
      className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
    >
      <ArrowLeft className="w-4 h-4" />
      Back to users
    </Link>
  );
}

export default UserProfilePage;
