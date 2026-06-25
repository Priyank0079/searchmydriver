import { useState } from 'react';
import ManagePricing from './ManagePricing';
import ManageSubscriptions from './ManageSubscriptions';
import { MapPin, Mountain, CalendarRange } from 'lucide-react';

const FareManagement = () => {
  const [activeTab, setActiveTab] = useState('incity'); // 'incity', 'outstation', 'monthly'

  return (
    <div className="min-h-screen bg-slate-50 space-y-6 animate-fade-in-up pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Fare Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure pricing, commissions, and subscription plans across all service types.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-white border border-slate-200 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('incity')}
          className={`flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg transition-colors ${
            activeTab === 'incity'
              ? 'bg-slate-900 text-white'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <MapPin className="w-4 h-4" />
          InCity
        </button>
        <button
          onClick={() => setActiveTab('outstation')}
          className={`flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg transition-colors ${
            activeTab === 'outstation'
              ? 'bg-slate-900 text-white'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Mountain className="w-4 h-4" />
          Outstation
        </button>
        <button
          onClick={() => setActiveTab('monthly')}
          className={`flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg transition-colors ${
            activeTab === 'monthly'
              ? 'bg-slate-900 text-white'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <CalendarRange className="w-4 h-4" />
          Monthly (Subscriptions)
        </button>
      </div>

      <div className="mt-6">
        {activeTab === 'incity' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
             <ManagePricing defaultFilter="hourly" hideHeader />
          </div>
        )}
        
        {activeTab === 'outstation' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
             <ManagePricing defaultFilter="outstation" hideHeader />
          </div>
        )}

        {activeTab === 'monthly' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
             <ManageSubscriptions hideHeader />
          </div>
        )}
      </div>
    </div>
  );
};

export default FareManagement;
