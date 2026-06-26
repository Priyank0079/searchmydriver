import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock, Check, Calendar } from 'lucide-react';
import Button from '../../../../../components/Button';
import DateTimePickerField from '../../../../../components/inputs/DateTimePickerField';
import PageShell from '../../components/PageShell';
import useBookingDraftStore from '../../../../../store/user/useBookingDraftStore';
import { SERVICE_TYPES } from '../../../../../constants/serviceTypes';
import { BOOKING_TYPE } from '../../../../../constants/bookingStatus';

const MonthlyBookingTypePage = () => {
  const navigate = useNavigate();
  const setServiceType = useBookingDraftStore((s) => s.setServiceType);
  const setBookingType = useBookingDraftStore((s) => s.setBookingType);
  const setMonthly = useBookingDraftStore((s) => s.setMonthly);
  const draftMonthly = useBookingDraftStore((s) => s.monthly);

  const [startDate, setStartDate] = useState(draftMonthly?.startDate || null);
  const [endDate, setEndDate] = useState(draftMonthly?.endDate || null);
  const [workingHoursPerDay, setWorkingHoursPerDay] = useState(draftMonthly?.workingHoursPerDay || 9);
  const [includeLunch, setIncludeLunch] = useState(draftMonthly?.includeLunch ?? true);

  useEffect(() => {
    setServiceType(SERVICE_TYPES.MONTHLY);
    setBookingType(BOOKING_TYPE.SCHEDULED); // Monthly rides are inherently scheduled
  }, [setServiceType, setBookingType]);

  const [nowAnchorMs] = useState(() => Date.now());
  const minScheduledDate = useMemo(() => new Date(nowAnchorMs), [nowAnchorMs]);

  const handleContinue = () => {
    setMonthly({
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      workingHoursPerDay: Number(workingHoursPerDay),
      includeLunch
    });
    // For monthly rides, the next step is typically to just go straight to Review/Confirm
    // but the original flow goes to 'variants' (pickup, dropoff, etc.).
    // We should send them to pickup selection.
    navigate('/user/book/pickup');
  };

  const canContinue =
    startDate &&
    endDate &&
    new Date(startDate).getTime() >= minScheduledDate.getTime() &&
    new Date(endDate).getTime() > new Date(startDate).getTime() &&
    workingHoursPerDay > 0;

  return (
    <PageShell
      title="Monthly Ride Details"
      subtitle="Book a dedicated driver for a month"
      footer={
        <Button fullWidth disabled={!canContinue} onClick={handleContinue}>
          Continue
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="bg-white rounded-2xl p-4 border border-border shadow-sm">
          <DateTimePickerField
            label="Start Date"
            icon={CalendarClock}
            value={startDate}
            onChange={setStartDate}
            minDate={minScheduledDate}
            placeholder="Select Start Date"
            sheetTitle="Select Start Date"
          />
          <div className="my-3 border-t border-border-light" />
          <DateTimePickerField
            label="End Date"
            icon={Calendar}
            value={endDate}
            onChange={setEndDate}
            minDate={startDate ? new Date(startDate) : minScheduledDate}
            placeholder="Select End Date"
            sheetTitle="Select End Date"
          />
        </div>

        <div className="bg-white rounded-2xl p-4 border border-border shadow-sm space-y-4">
          <div>
            <label className="block text-sm font-medium text-text mb-1">
              Working Hours Per Day
            </label>
            <input
              type="number"
              min="1"
              max="24"
              value={workingHoursPerDay}
              onChange={(e) => setWorkingHoursPerDay(e.target.value)}
              className="w-full bg-gray-50 border border-border rounded-xl px-4 py-2.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-text">Include Lunch Hour?</span>
            <button
              type="button"
              onClick={() => setIncludeLunch(!includeLunch)}
              className={`w-12 h-6 rounded-full p-1 transition-colors ${
                includeLunch ? 'bg-primary' : 'bg-gray-200'
              }`}
            >
              <div
                className={`w-4 h-4 bg-white rounded-full transition-transform ${
                  includeLunch ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </PageShell>
  );
};

export default MonthlyBookingTypePage;
