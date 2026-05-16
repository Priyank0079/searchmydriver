import { useState } from 'react';
import { DollarSign, Save } from 'lucide-react';
import Card from '../../../components/Card';
import Input from '../../../components/Input';
import Button from '../../../components/Button';

const PaymentSettings = () => {
  const [config, setConfig] = useState({
    commissionRate: '15',
    baseFare: '100',
    perKmRate: '12',
    waitingCharge: '2',
    cancellationFee: '50',
  });

  const handleChange = (field) => (e) => {
    setConfig((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSave = () => {
    // API call will go here
    alert('Payment settings saved successfully!');
  };

  return (
    <div className="max-w-4xl space-y-6 animate-fade-in-up pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Pricing & Commission</h2>
          <p className="text-sm text-slate-500 mt-1">Configure service rates, commission and penalty fees</p>
        </div>
        <Button 
          onClick={handleSave}
          className="px-6 py-3 flex items-center gap-2 shadow-lg shadow-primary/20"
        >
          <Save className="w-4.5 h-4.5" /> Save Changes
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="md:col-span-2">
          <h3 className="text-base font-bold text-slate-800 mb-6 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" /> Service Fee Structure
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Input
              label="Platform Commission (%)"
              type="number"
              placeholder="15"
              value={config.commissionRate}
              onChange={handleChange('commissionRate')}
              suffix="%"
            />
            <Input
              label="Base Fare (₹)"
              type="number"
              placeholder="100"
              value={config.baseFare}
              onChange={handleChange('baseFare')}
              prefix="₹"
            />
            <Input
              label="Per Km Rate (₹)"
              type="number"
              placeholder="12"
              value={config.perKmRate}
              onChange={handleChange('perKmRate')}
              prefix="₹"
            />
          </div>
        </Card>

        <Card>
          <h3 className="text-base font-bold text-slate-800 mb-6">Waiting Charges</h3>
          <Input
            label="Waiting Charge (₹ per min)"
            type="number"
            placeholder="2"
            value={config.waitingCharge}
            onChange={handleChange('waitingCharge')}
            prefix="₹"
          />
        </Card>

        <Card>
          <h3 className="text-base font-bold text-slate-800 mb-6">Cancellation Fees</h3>
          <Input
            label="Cancellation Charge (₹)"
            type="number"
            placeholder="50"
            value={config.cancellationFee}
            onChange={handleChange('cancellationFee')}
            prefix="₹"
          />
        </Card>
      </div>
    </div>
  );
};

export default PaymentSettings;
