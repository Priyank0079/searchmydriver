import { useState, useEffect } from 'react';
import { Save, CalendarRange, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../utils/api';
import Button from '../../../components/Button';
import Input from '../../../components/Input';

const ManageSubscriptions = ({ hideHeader }) => {
  const [fee, setFee] = useState(2000);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/admin/platform-settings')
      .then((res) => {
        if (res.data?.data?.monthlyRideRegistrationFee != null) {
          setFee(res.data.data.monthlyRideRegistrationFee);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      // First fetch current settings to retain other fields
      const res = await api.get('/admin/platform-settings');
      const current = res.data?.data || {};
      
      // Update with new fee
      await api.put('/admin/platform-settings', {
        ...current,
        monthlyRideRegistrationFee: Number(fee),
      });
      toast.success('Monthly registration fee updated successfully');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update fee');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-10 h-10 text-slate-400 animate-spin" />
        <p className="text-sm text-slate-500 font-medium">Loading configuration…</p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 animate-fade-in-up ${hideHeader ? '' : 'pb-10'}`}>
      {!hideHeader && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Monthly Rides</h1>
            <p className="text-sm text-slate-500 mt-1">
              Configure the upfront registration fee for monthly bookings.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 max-w-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <CalendarRange className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Registration Fee</h2>
            <p className="text-xs text-slate-500">
              Users must pay this amount to the platform before their monthly request is dispatched to drivers.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <Input
            label="Fee Amount (₹)"
            type="number"
            min="0"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
          />

          <Button
            variant="admin"
            className="w-full flex items-center justify-center gap-2"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save Configuration'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ManageSubscriptions;
