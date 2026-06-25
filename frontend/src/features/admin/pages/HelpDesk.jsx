import { useState } from 'react';
import {
  Headset,
  Phone,
  CheckCircle,
  Clock,
  Search,
  X,
} from 'lucide-react';
import Card from '../../../components/Card';
import Button from '../../../components/Button';
import { useSocketEvent } from '../../../hooks/useSocket';
import { S2C_EVENTS } from '../../../constants/socketEvents';
import { useCachedQuery } from '../../../hooks/useCachedQuery';
import { buildCacheKey } from '../../../store/lib/buildCacheKey';
import api from '../../../utils/api';
import { createQueryStore } from '../../../store/lib/createQueryStore';

const useSupportTicketsStore = createQueryStore(async () => {
  const { data } = await api.get('/admin/support/tickets');
  return data.tickets;
});

const HelpDesk = () => {
  const [search, setSearch] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const cacheKey = buildCacheKey('admin-support-tickets', {});
  const { data: tickets = [], loading, refetch } = useCachedQuery(useSupportTicketsStore, cacheKey, {});

  // Live reload tickets when a new one comes in
  useSocketEvent(S2C_EVENTS.ADMIN_ALERT, () => {
    refetch();
  });

  const handleResolve = async (id) => {
    try {
      await api.patch(`/admin/support/tickets/${id}/status`);
      refetch();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredTickets = (tickets || []).filter((t) => {
    const term = search.toLowerCase();
    if (!term.trim()) return true;
    const user = t.userId || t.driverId;
    return (
      t.ticketNumber?.toLowerCase().includes(term) ||
      t.ticketNumber?.toLowerCase().includes(term) ||
      user?.name?.toLowerCase().includes(term) ||
      user?.phone_no?.includes(term) ||
      user?.phone?.includes(term) ||
      t.contactName?.toLowerCase().includes(term) ||
      t.contactPhone?.toLowerCase().includes(term) ||
      t.subject?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Headset className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text">Help Desk</h1>
            <p className="text-sm text-text-muted mt-1">Manage and resolve support tickets from users and drivers</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by ticket number, name, phone, or subject..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading tickets...</div>
        ) : filteredTickets.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            No tickets found matching your criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="px-6 py-3 font-medium">Ticket</th>
                  <th className="px-6 py-3 font-medium">From</th>
                  <th className="px-6 py-3 font-medium">Subject</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTickets.map((ticket) => {
                  const person = ticket.userId || ticket.driverId || { name: ticket.contactName, phone_no: ticket.contactPhone };
                  const phoneStr = person.phone_no || person.phone;
                  const isResolved = ticket.status === 'resolved';

                  return (
                    <tr key={ticket._id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{ticket.ticketNumber}</div>
                        <div className="text-xs text-slate-500">
                          {new Date(ticket.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase ${
                              ticket.creatorType === 'driver'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {ticket.creatorType}
                          </span>
                          <span className="font-medium text-slate-900">{person?.name || 'Unknown'}</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">{phoneStr}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900 max-w-xs truncate" title={ticket.subject}>
                          {ticket.subject}
                        </div>
                        <div className="text-xs text-slate-500 max-w-xs truncate mt-0.5" title={ticket.description}>
                          {ticket.description}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                            isResolved
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {isResolved ? <CheckCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                          {isResolved ? 'Resolved' : 'Open'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-xs text-slate-600"
                            onClick={() => setSelectedTicket(ticket)}
                          >
                            View Details
                          </Button>
                          {phoneStr && (
                            <a
                              href={`tel:${phoneStr}`}
                              className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors"
                              title="Call"
                            >
                              <Phone className="w-4 h-4" />
                            </a>
                          )}
                          {!isResolved && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleResolve(ticket._id)}
                            >
                              Mark Resolved
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-slate-900">Ticket Details</h3>
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ticket Number</label>
                  <p className="mt-1 text-sm font-medium text-slate-900">{selectedTicket.ticketNumber}</p>
                </div>
                
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Submitted By</label>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {(selectedTicket.userId || selectedTicket.driverId)?.name || selectedTicket.contactName || 'Unknown'} 
                    <span className="text-slate-500 ml-2">
                      ({selectedTicket.creatorType})
                    </span>
                  </p>
                  <p className="text-sm text-slate-600 mt-1">
                    {((selectedTicket.userId || selectedTicket.driverId)?.phone_no) || ((selectedTicket.userId || selectedTicket.driverId)?.phone) || selectedTicket.contactPhone || 'No Phone Number'}
                  </p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Subject</label>
                  <p className="mt-1 text-sm font-medium text-slate-900">{selectedTicket.subject}</p>
                </div>
                
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</label>
                  <p className="mt-1 text-sm text-slate-600 whitespace-pre-wrap p-3 bg-slate-50 rounded-lg border border-slate-100">
                    {selectedTicket.description}
                  </p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</label>
                  <p className="mt-1">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        selectedTicket.status === 'resolved'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {selectedTicket.status === 'resolved' ? 'Resolved' : 'Open'}
                    </span>
                  </p>
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <Button variant="outline" onClick={() => setSelectedTicket(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HelpDesk;
