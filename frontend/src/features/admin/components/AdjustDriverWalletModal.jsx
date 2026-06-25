import { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import Button from '../../../components/Button';
import Input from '../../../components/Input';
import api from '../../../utils/api';

const AdjustDriverWalletModal = ({ isOpen, onClose, onSuccess }) => {
  const [driverSearch, setDriverSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(driverSearch), 300);
    return () => clearTimeout(timer);
  }, [driverSearch]);
  
  const [drivers, setDrivers] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(null);
  
  const [amount, setAmount] = useState('');
  const [action, setAction] = useState('CREDIT');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  // Fetch drivers on search
  useEffect(() => {
    let active = true;
    const fetchDrivers = async () => {
      if (!debouncedSearch) {
        setDrivers([]);
        return;
      }
      setSearchLoading(true);
      try {
        const res = await api.get(`/admin/drivers?search=${debouncedSearch}&limit=5`);
        if (active) {
          setDrivers(res.data?.data?.data || []);
        }
      } catch (err) {
        console.error('Error fetching drivers', err);
      } finally {
        if (active) setSearchLoading(false);
      }
    };
    fetchDrivers();
    return () => { active = false; };
  }, [debouncedSearch]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedDriver || !amount || !action) return;

    setIsSubmitting(true);
    try {
      await api.post('/admin/driver-wallet/adjust', {
        driverId: selectedDriver._id,
        amount: Number(amount),
        action,
        reason,
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to adjust wallet');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-slide-up">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Adjust Driver Wallet</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {!selectedDriver ? (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  placeholder="Search driver by name or phone..."
                  value={driverSearch}
                  onChange={(e) => setDriverSearch(e.target.value)}
                  className="pl-10"
                  autoFocus
                />
              </div>
              
              {searchLoading && <div className="text-sm text-slate-500 text-center py-4">Searching...</div>}
              
              {drivers.length > 0 && (
                <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-48 overflow-y-auto">
                  {drivers.map(d => (
                    <div 
                      key={d._id} 
                      className="p-3 hover:bg-slate-50 cursor-pointer flex justify-between items-center"
                      onClick={() => setSelectedDriver(d)}
                    >
                      <div>
                        <div className="font-medium text-sm text-slate-800">{d.name}</div>
                        <div className="text-xs text-slate-500">{d.phone}</div>
                      </div>
                      <div className="text-sm font-semibold text-emerald-600">
                        ₹{d.wallet?.balance || 0}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div>
                  <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-0.5">Selected Driver</div>
                  <div className="font-medium text-slate-800">{selectedDriver.name}</div>
                  <div className="text-xs text-slate-500">{selectedDriver.phone}</div>
                </div>
                <button 
                  type="button" 
                  onClick={() => setSelectedDriver(null)}
                  className="text-xs text-primary font-medium hover:underline"
                >
                  Change
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className={`
                  flex items-center justify-center p-3 border rounded-xl cursor-pointer transition-colors
                  ${action === 'CREDIT' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}
                `}>
                  <input 
                    type="radio" 
                    name="action" 
                    value="CREDIT" 
                    className="sr-only"
                    checked={action === 'CREDIT'}
                    onChange={() => setAction('CREDIT')}
                  />
                  <span className="font-medium text-sm">Add Funds</span>
                </label>
                <label className={`
                  flex items-center justify-center p-3 border rounded-xl cursor-pointer transition-colors
                  ${action === 'DEBIT' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}
                `}>
                  <input 
                    type="radio" 
                    name="action" 
                    value="DEBIT" 
                    className="sr-only"
                    checked={action === 'DEBIT'}
                    onChange={() => setAction('DEBIT')}
                  />
                  <span className="font-medium text-sm">Deduct Funds</span>
                </label>
              </div>

              <Input
                label="Amount (₹)"
                type="number"
                min="1"
                required
                placeholder="e.g. 500"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />

              <Input
                label="Reason / Note"
                required
                placeholder="e.g. Manual adjustment for toll"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          )}

          <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              loading={isSubmitting} 
              disabled={!selectedDriver || !amount || !reason}
            >
              Confirm
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdjustDriverWalletModal;
