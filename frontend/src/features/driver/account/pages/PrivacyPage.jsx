import Card from '../../../../components/Card';
import { ShieldCheck, Mail, Phone, Lock, Eye, Database } from 'lucide-react';

const sections = [
  {
    icon: Eye,
    title: 'What we collect',
    text: 'We only use the information needed to run your driver account, trips, payments, support requests, and safety features.',
  },
  {
    icon: Database,
    title: 'How we use it',
    text: 'Your data helps us manage rides, protect your account, improve service quality, and meet legal or payment requirements.',
  },
  {
    icon: Lock,
    title: 'How we protect it',
    text: 'We use access controls, encrypted transport, and account checks to keep your profile and trip data secure.',
  },
];

const PrivacyPage = () => {
  return (
    <div className="flex-1 bg-bg px-4 py-5 space-y-4">
      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white rounded-[28px] p-5 shadow-xl overflow-hidden relative">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.24),_transparent_35%),radial-gradient(circle_at_bottom_left,_rgba(56,189,248,0.18),_transparent_40%)]" />
        <div className="relative space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/10">
            <ShieldCheck className="w-6 h-6 text-cyan-300" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/60">Privacy Policy</p>
            <h1 className="text-2xl font-bold mt-1">Your privacy matters</h1>
            <p className="text-sm text-white/75 mt-2 leading-relaxed">
              This page explains how SearchMyDriver uses and protects driver information.
            </p>
          </div>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="divide-y divide-border-light">
          {sections.map((section) => (
            <div key={section.title} className="p-4 flex gap-3">
              <div className="w-10 h-10 rounded-xl bg-bg flex items-center justify-center shrink-0">
                <section.icon className="w-5 h-5 text-text-secondary" />
              </div>
              <div>
                <h2 className="font-semibold text-text">{section.title}</h2>
                <p className="text-sm text-text-secondary mt-1 leading-relaxed">{section.text}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4 space-y-4">
        <h2 className="text-lg font-bold text-text">Contact us</h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          If you have questions about privacy, data access, or account deletion, reach out to us directly.
        </p>

        <div className="space-y-3">
          <a
            href="tel:9981570665"
            className="flex items-center gap-3 p-3 rounded-2xl bg-bg border border-border-light hover:bg-slate-50 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm">
              <Phone className="w-5 h-5 text-text-secondary" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-text-muted">Phone</p>
              <p className="font-semibold text-text">9981570665</p>
            </div>
          </a>

          <a
            href="mailto:Searchmydrivers@gmail.com"
            className="flex items-center gap-3 p-3 rounded-2xl bg-bg border border-border-light hover:bg-slate-50 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm">
              <Mail className="w-5 h-5 text-text-secondary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-text-muted">Email</p>
              <p className="font-semibold text-text break-all">Searchmydrivers@gmail.com</p>
            </div>
          </a>
        </div>
      </Card>
    </div>
  );
};

export default PrivacyPage;
