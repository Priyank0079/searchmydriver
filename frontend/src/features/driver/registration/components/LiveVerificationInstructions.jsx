import { IdCard, Video, Sun } from 'lucide-react';
import { LIVE_VERIFICATION_MIN_SECONDS } from '../../../../utils/driverOnboarding';

const items = [
  {
    icon: IdCard,
    text: (
      <>
        Hold your <strong className="text-slate-900 font-semibold">Aadhaar card</strong> to the
        camera so details are readable.
      </>
    ),
  },
  {
    icon: IdCard,
    text: (
      <>
        Then show your <strong className="text-slate-900 font-semibold">driving licence</strong>{' '}
        clearly on camera.
      </>
    ),
  },
  {
    icon: Video,
    text: (
      <>
        Record at least <strong className="text-slate-900 font-semibold">{LIVE_VERIFICATION_MIN_SECONDS} seconds</strong>.
        Live recording only — gallery uploads are not allowed.
      </>
    ),
  },
  {
    icon: Sun,
    text: 'Use good lighting, a steady hand, and a quiet place.',
  },
];

const LiveVerificationInstructions = () => (
  <ul className="space-y-3 mb-5">
    {items.map(({ icon: Icon, text }, i) => (
      <li
        key={i}
        className="flex gap-3 text-sm text-slate-700 bg-white rounded-xl border border-slate-200 p-3"
      >
        <span className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-primary" />
        </span>
        <span className="leading-relaxed pt-0.5">{text}</span>
      </li>
    ))}
  </ul>
);

export default LiveVerificationInstructions;
