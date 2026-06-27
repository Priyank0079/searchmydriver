import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Compass, CalendarCheck, ShieldCheck, CheckCircle2, ArrowRight } from 'lucide-react';

const ServicesPage = () => {
  const navigate = useNavigate();

  const services = [
    {
      icon: <Clock className="w-8 h-8 text-amber-500" />,
      title: "Hourly Driver Booking",
      subtitle: "Flexible short-term hiring starting from 4-hour slabs",
      description: "Perfect for local shopping, business meetings, medical visits, or a night out. Avoid the hassle of parking and city traffic congestion.",
      features: [
        "4-hour, 8-hour, and 12-hour flexible time slabs",
        "Add additional hours easily directly from the app",
        "Perfect for manual and automatic premium cars",
        "Real-time tracking and instant replacement support"
      ]
    },
    {
      icon: <Compass className="w-8 h-8 text-amber-500" />,
      title: "Outstation Trips",
      subtitle: "Professional drivers for round trips and one-way travel",
      description: "Plan your weekend getaways or interstate journeys without worrying about highway stress, fatigue, or unfamiliar routes.",
      features: [
        "Highly experienced highway and night-driving specialists",
        "Round-trip and one-way package configurations",
        "Driver food and accommodation handled transparently",
        "Emergency roadside support coordination"
      ]
    },
    {
      icon: <CalendarCheck className="w-8 h-8 text-amber-500" />,
      title: "Monthly Subscriptions",
      subtitle: "Dedicated permanent drivers for daily commute needs",
      description: "Upgrade your daily office commute or children's school run. Get a dedicated driver allocated exclusively to your family on a monthly model.",
      features: [
        "Fully vetted, permanent driver assigned to your profile",
        "Consistent daily schedule and backup driver guarantee",
        "Simplified monthly invoicing and auto-renewal options",
        "Complete replacements if you require a change"
      ]
    }
  ];

  return (
    <div className="py-16 md:py-24 bg-slate-50 relative overflow-hidden">
      <div className="absolute top-1/4 right-1/4 w-[350px] h-[350px] bg-amber-500/5 rounded-full blur-[90px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-10 w-[450px] h-[450px] bg-blue-500/5 rounded-full blur-[110px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-20">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-slate-200 text-amber-600 text-xs font-semibold shadow-sm">
            <ShieldCheck className="w-3 h-3" /> Our Expertise
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-950">
            Our Premium Services
          </h1>
          <p className="text-slate-500 text-lg font-medium">
            Choose the service that fits your requirements. We offer a comprehensive suite of safe driving solutions.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {services.map((service, idx) => (
            <div 
              key={idx} 
              className="bg-white border border-slate-200 p-8 rounded-3xl space-y-6 flex flex-col justify-between hover:shadow-lg transition-all group"
            >
              <div className="space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center group-hover:scale-105 transition-transform">
                  {service.icon}
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-950 group-hover:text-amber-600 transition-colors">
                    {service.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 font-bold">{service.subtitle}</p>
                </div>
                <p className="text-slate-600 text-sm leading-relaxed font-medium">
                  {service.description}
                </p>
              </div>

              <div className="space-y-4 pt-6 border-t border-slate-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">What's Included</h4>
                <ul className="space-y-2.5">
                  {service.features.map((feature, fIdx) => (
                    <li key={fIdx} className="flex gap-2.5 items-start text-xs text-slate-600 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => navigate('/welcome')}
                className="w-full mt-6 py-3 bg-slate-50 border border-slate-200 text-amber-600 hover:bg-amber-500 hover:text-black font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-2"
              >
                Book This Service <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ServicesPage;
