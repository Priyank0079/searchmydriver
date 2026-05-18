import { ArrowLeft, Shield } from 'lucide-react';

const OnboardingPageHeader = ({
  title,
  subtitle,
  icon: Icon = Shield,
  onBack,
  badge,
}) => (
  <div className="bg-white px-4 pt-6 pb-5 shadow-sm border-b border-slate-100">
    <div className="flex items-start gap-3">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="p-2 -ml-2 mt-0.5 rounded-xl hover:bg-slate-50 shrink-0"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
      )}
      <div className="w-11 h-11 bg-slate-900 rounded-2xl flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-xl font-bold text-slate-900 leading-tight">{title}</h1>
          {badge}
        </div>
        {subtitle && (
          <p className="text-sm text-slate-600 mt-1 leading-relaxed">{subtitle}</p>
        )}
      </div>
    </div>
  </div>
);

export default OnboardingPageHeader;
