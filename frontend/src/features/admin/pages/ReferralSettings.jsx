import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Save, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import Card from '../../../components/Card';
import Button from '../../../components/Button';
import Input from '../../../components/Input';
import Toggle from '../../../components/Toggle';
import api from '../../../utils/api';

export default function ReferralSettings() {
  const [settings, setSettings] = useState({
    user: {
      enabled: false,
      signupBonus: 0,
      rewardAmount: 0,
      minRideAmountForEligibility: 0,
      walletExpiryDays: 365,
      maxWalletUsagePercentage: 10,
    },
    driver: {
      enabled: false,
      signupBonus: 0,
      rewardAmount: 0,
      minCompletedTripsForEligibility: 1,
      minEarningsForEligibility: 0,
      autoApproveRewards: false,
    },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/admin/referral-settings');
      if (res.data?.data?.referral) {
        setSettings({
          user: res.data.data.referral.user || settings.user,
          driver: res.data.data.referral.driver || settings.driver,
        });
      }
    } catch (err) {
      toast.error('Failed to load referral settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/admin/referral-settings', settings);
      toast.success('Referral settings updated successfully');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (type, field, value) => {
    setSettings(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [field]: value
      }
    }));
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Referral Settings</h1>
          <p className="text-text-muted mt-1">Configure refer & earn rules for users and drivers</p>
        </div>
        <Button onClick={handleSave} loading={saving} icon={Save}>
          Save Changes
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* User Referral Settings */}
        <Card className="p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-500" />
              <h2 className="text-lg font-semibold">User Referrals</h2>
            </div>
            <Toggle 
              label=""
              checked={settings.user.enabled}
              onChange={(v) => handleChange('user', 'enabled', v)}
            />
          </div>

          <div className="space-y-4">
            <Input
              label="Sign-up Bonus (₹)"
              type="number"
              value={settings.user.signupBonus}
              onChange={(e) => handleChange('user', 'signupBonus', Number(e.target.value))}
              disabled={!settings.user.enabled}
            />
            <Input
              label="Referrer Reward (₹)"
              type="number"
              value={settings.user.rewardAmount}
              onChange={(e) => handleChange('user', 'rewardAmount', Number(e.target.value))}
              disabled={!settings.user.enabled}
            />
            <Input
              label="Min Ride Amount for Eligibility (₹)"
              type="number"
              value={settings.user.minRideAmountForEligibility}
              onChange={(e) => handleChange('user', 'minRideAmountForEligibility', Number(e.target.value))}
              disabled={!settings.user.enabled}
            />
            <Input
              label="Wallet Expiry (Days)"
              type="number"
              value={settings.user.walletExpiryDays}
              onChange={(e) => handleChange('user', 'walletExpiryDays', Number(e.target.value))}
              disabled={!settings.user.enabled}
            />
            <Input
              label="Max Wallet Usage Per Ride (%)"
              type="number"
              value={settings.user.maxWalletUsagePercentage}
              onChange={(e) => handleChange('user', 'maxWalletUsagePercentage', Number(e.target.value))}
              max={100}
              min={0}
              disabled={!settings.user.enabled}
            />
          </div>
        </Card>

        {/* Driver Referral Settings */}
        <Card className="p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-500" />
              <h2 className="text-lg font-semibold">Driver Referrals</h2>
            </div>
            <Toggle 
              label=""
              checked={settings.driver.enabled}
              onChange={(v) => handleChange('driver', 'enabled', v)}
            />
          </div>

          <div className="space-y-4">
            <Input
              label="Sign-up Bonus (₹)"
              type="number"
              value={settings.driver.signupBonus}
              onChange={(e) => handleChange('driver', 'signupBonus', Number(e.target.value))}
              disabled={!settings.driver.enabled}
            />
            <Input
              label="Referrer Reward (₹)"
              type="number"
              value={settings.driver.rewardAmount}
              onChange={(e) => handleChange('driver', 'rewardAmount', Number(e.target.value))}
              disabled={!settings.driver.enabled}
            />
            <div className="p-3 bg-brand-light/30 rounded-lg text-sm text-text-muted">
              Driver eligibility requires either of the following conditions to be met before the referrer gets the reward.
            </div>
            <Input
              label="Min Completed Trips"
              type="number"
              value={settings.driver.minCompletedTripsForEligibility}
              onChange={(e) => handleChange('driver', 'minCompletedTripsForEligibility', Number(e.target.value))}
              disabled={!settings.driver.enabled}
            />
            <Input
              label="Min Earnings (₹)"
              type="number"
              value={settings.driver.minEarningsForEligibility}
              onChange={(e) => handleChange('driver', 'minEarningsForEligibility', Number(e.target.value))}
              disabled={!settings.driver.enabled}
            />
            <div className="pt-2">
              <Toggle 
                label="Auto-Approve Driver Rewards"
                checked={settings.driver.autoApproveRewards}
                onChange={(v) => handleChange('driver', 'autoApproveRewards', v)}
                disabled={!settings.driver.enabled}
              />
              <p className="text-xs text-text-muted mt-1 ml-1">If false, rewards must be manually approved in the Referrals List.</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
