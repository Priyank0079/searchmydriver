import { useState } from 'react';
import {
  Headset,
  Phone,
  CheckCircle,
  Clock,
  Search,
  RefreshCw,
  MessageSquare,
} from 'lucide-react';
import Card from '../../../components/Card';
import Button from '../../../components/Button';
import { useSocketEvent } from '../../../hooks/useSocket';
import { S2C_EVENTS } from '../../../constants/socketEvents';
import { useCachedQuery } from '../../../hooks/useCachedQuery';
import { buildCacheKey } from '../../../store/lib/buildCacheKey';
import api from '../../../utils/api';
import { createQueryStore } from '../../../store/lib/createQueryStore';
import toast from 'react-hot-toast';

const useSupportTicketsStore = createQueryStore(async () => {
  const { data } = await api.get('/admin/support/tickets');
  return data.tickets;
});

const ManageWebTickets = () => {
  const [search, setSearch] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const cacheKey = buildCacheKey('admin-support-tickets-web', {});
  const { data, loading, refetch } = useCachedQuery(useSupportTicketsStore, cacheKey, {});
  const tickets = data || [];

  // Live reload tickets when a new one comes in
  useSocketEvent(S2C_EVENTS.ADMIN_ALERT, () => {
    refetch();
  });

  const handleResolve = async (id) => {
    try {
      await api.patch(`/admin/support/tickets/${id}/status`);
      toast.success('Ticket marked as resolved');
      refetch();
      if (selectedTicket?._id === id) {
        setSelectedTicket((prev) => ({ ...prev, status: 'resolved' }));
      }
    } catch (err) {
      toast.error('Failed to resolve ticket');
      console.error(err);
    }
  };

  // Only tickets raised from the public web form (no userId or driverId, has contactName)
  const webTickets = (tickets || []).filter((t) => !t.userId && !t.driverId);

  const filteredTickets = webTickets.filter((t) => {
    const term = search.toLowerCase();
    if (!term.trim()) return true;
    return (
      t.ticketNumber?.toLowerCase().includes(term) ||
      t.contactName?.toLowerCase().includes(term) ||
      t.contactPhone?.toLowerCase().includes(term) ||
      t.subject?.toLowerCase().includes(term) ||
      t.description?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-slate-900">Website Support Tickets</h2>
          <p className="text-sm text-slate-500 font-medium">
            Manage and resolve support tickets raised by public visitors from the website contact form.
          </p>
        </div>
        <Button onClick={refetch} variant="outline" className="p-2.5">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by ticket number, name, phone, or subject..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {/* Ticket List Table */}
        <div className={selectedTicket ? 'lg:col-span-7' : 'lg:col-span-12'}>
          <Card className="p-0 overflow-hidden border-slate-200">
            {loading && tickets.length === 0 ? (
              <div className="p-12 text-center text-slate-500 font-medium">Loading tickets...</div>
            ) : filteredTickets.length === 0 ? (
              <div className="p-12 text-center text-slate-500 font-medium">
                No website support tickets found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="px-6 py-3.5">Ticket</th>
                      <th className="px-6 py-3.5">From</th>
                      <th className="px-6 py-3.5">Subject</th>
                      <th className="px-6 py-3.5">Status</th>
                      <th className="px-6 py-3.5">Created At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredTickets.map((t) => (
                      <tr
                        key={t._id}
                        onClick={() => setSelectedTicket(t)}
                        className={`hover:bg-slate-50/80 cursor-pointer transition-colors ${
                          selectedTicket?._id === t._id ? 'bg-slate-100/50' : ''
                        }`}
                      >
                        <td className="px-6 py-4 font-bold text-slate-900">{t.ticketNumber}</td>
                        <td className="px-6 py-4">
                          <p className="text-slate-800 font-bold">{t.contactName}</p>
                          <p className="text-xs text-slate-500">{t.contactPhone}</p>
                        </td>
                        <td className="px-6 py-4 max-w-[200px] truncate">{t.subject}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase ${
                              t.status === 'resolved'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {t.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-400">
                          {new Date(t.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Selected Ticket Drawer/Details */}
        {selectedTicket && (
          <div className="lg:col-span-5">
            <Card className="border-slate-200 p-6 space-y-6">
              <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{selectedTicket.ticketNumber}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Created on {new Date(selectedTicket.createdAt).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                  <div className="flex justify-between text-xs text-slate-500 font-bold">
                    <span>Contact Person:</span>
                    <span className="text-slate-900 font-extrabold">{selectedTicket.contactName}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500 font-bold">
                    <span>Contact Phone:</span>
                    <span className="text-slate-900 font-extrabold flex items-center gap-1.5">
                      <Phone className="w-3 h-3 text-slate-400" /> {selectedTicket.contactPhone}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500 font-bold">
                    <span>Role Type:</span>
                    <span className="text-slate-900 font-extrabold capitalize">{selectedTicket.creatorType}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Subject</h4>
                  <p className="text-sm font-bold text-slate-900">{selectedTicket.subject}</p>
                </div>

                <div className="space-y-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Description</h4>
                  <div className="text-sm text-slate-700 bg-slate-50/50 p-4 rounded-xl border border-slate-100 whitespace-pre-wrap leading-relaxed">
                    {selectedTicket.description}
                  </div>
                </div>
              </div>

              {selectedTicket.status === 'open' && (
                <div className="pt-4 border-t border-slate-100">
                  <button
                    onClick={() => handleResolve(selectedTicket._id)}
                    className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" /> Mark as Resolved
                  </button>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

const X = ({ className, ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={2}
    stroke="currentColor"
    className={className}
    {...props}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export default ManageWebTickets;
