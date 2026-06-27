import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Smartphone, ShieldCheck, MapPin, UserCheck, Sparkles, ArrowRight } from 'lucide-react';

const HowItWorksPage = () => {
  const navigate = useNavigate();

  const steps = [
    {
      icon: <Smartphone className="w-8 h-8 text-amber-500" />,
      title: "1. Request a Driver",
      description: "Open the SearchMyDriver app or website, input your destination, select your vehicle type, and choose whether you need a driver hourly, monthly, or for an outstation trip.",
      details: [
        "Select booking type: Hourly, Outstation, or Monthly packages",
        "Provide details of your car (Manual vs Automatic transmission)",
        "Schedule for immediate pickup or set a future date & time"
      ]
    },
    {
      icon: <MapPin className="w-8 h-8 text-amber-500" />,
      title: "2. Driver Match & Track",
      description: "Our advanced matching system allocates the nearest verified professional driver suited to your car. You can track their arrival live on the map.",
      details: [
        "Real-time tracking of driver arrival",
        "Access driver details, photo, and experience details upfront",
        "Direct communication channel with your assigned driver"
      ]
    },
    {
      icon: <ShieldCheck className="w-8 h-8 text-amber-500" />,
      title: "3. Sit Back & Relax",
      description: "Your driver arrives in uniform, completes a quick inspection checklist, and takes the wheel. Enjoy a stress-free journey in the comfort of your own car.",
      details: [
        "Pre-trip vehicle check for safety assurance",
        "OTP verification before starting the ride",
        "Safe driving focusing on speed limits and route efficiency"
      ]
    },
    {
      icon: <UserCheck className="w-8 h-8 text-amber-500" />,
      title: "4. Easy Payment & Rating",
      description: "Once you reach your destination, complete payment securely via the app and rate your experience. Your billing is transparently calculated based on actual duration.",
      details: [
        "Transparent pricing with no hidden charges",
        "Multiple payment options: Wallet, UPI, Card, or Cash",
        "Rate your driver to maintain high service standards"
      ]
    }
  ];

  return (
    <div className="py-16 md:py-24 bg-slate-50 relative overflow-hidden">
      <div className="absolute top-1/3 left-1/4 w-[400px] h-[400px] bg-amber-500/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/3 right-1/4 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-20">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-slate-200 text-amber-600 text-xs font-semibold shadow-sm">
            <Sparkles className="w-3 h-3" /> Step-by-Step Guide
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-950">
            How SearchMyDriver Works
          </h1>
          <p className="text-slate-500 text-lg font-medium">
            Hiring a professional driver for your car is now simpler than ever. Follow these four simple steps.
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          <div className="space-y-8">
            {steps.map((step, idx) => (
              <div 
                key={idx} 
                className="bg-white border border-slate-200 p-8 rounded-2xl space-y-4 hover:border-amber-500/30 hover:shadow-md transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    {step.icon}
                  </div>
                  <h3 className="text-xl font-bold text-slate-950 group-hover:text-amber-600 transition-colors">
                    {step.title}
                  </h3>
                </div>
                <p className="text-slate-600 text-sm leading-relaxed">
                  {step.description}
                </p>
                <ul className="space-y-2 pt-2 border-t border-slate-100">
                  {step.details.map((detail, dIdx) => (
                    <li key={dIdx} className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      {detail}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Right sticky visual/CTA */}
          <div className="lg:sticky lg:top-28 space-y-8">
            <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-lg relative overflow-hidden text-center">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-amber-500/5 rounded-full blur-[40px] pointer-events-none" />
              
              <h3 className="text-2xl font-bold mb-4 text-slate-950">Ready to Experience SMD?</h3>
              <p className="text-slate-500 text-sm mb-8 leading-relaxed max-w-md mx-auto font-medium">
                Join thousands of vehicle owners who trust our platform daily for office commutes, weekend getaways, shopping trips, and night-outs.
              </p>

              <div className="space-y-4">
                <button
                  onClick={() => navigate('/welcome')}
                  className="w-full inline-flex items-center justify-center px-6 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-extrabold text-sm hover:from-amber-400 hover:to-yellow-300 transition-all transform hover:scale-[1.01] shadow-md shadow-amber-500/10"
                >
                  Book Your First Driver Now <ArrowRight className="ml-2 w-4 h-4" />
                </button>
                <button
                  onClick={() => navigate('/driver/login')}
                  className="w-full inline-flex items-center justify-center px-6 py-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm transition-all"
                >
                  Join as Partner Driver
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HowItWorksPage;
