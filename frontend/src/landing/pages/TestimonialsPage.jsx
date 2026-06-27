import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Sparkles } from 'lucide-react';

const TestimonialsPage = () => {
  const navigate = useNavigate();

  const testimonials = [
    {
      name: "Rajesh Kumar",
      role: "Luxury SUV Owner",
      avatar: "👨‍💼",
      rating: 5,
      content: "Finding a driver who handles luxury automatic cars with absolute care was always a challenge until I found SearchMyDriver. The onboarding is quick, the drivers are professional and well-mannered, and the pricing is completely transparent. Highly recommended for premium vehicle owners!",
      location: "New Delhi"
    },
    {
      name: "Sneha Sharma",
      role: "Working Professional",
      avatar: "👩‍💼",
      rating: 5,
      content: "I use their hourly services during weekend shopping trips and family events. Being able to track the driver in real-time gives us immense peace of mind. It allows me to enjoy my time with friends and family without stressing about parking or traffic.",
      location: "Gurugram"
    },
    {
      name: "Amit Patel",
      role: "Business Traveler",
      avatar: "👨‍💻",
      rating: 5,
      content: "I regularly book outstation drivers for my business trips to nearby cities. Highway driving can be exhausting, but the experienced drivers from SearchMyDriver make it very smooth and allow me to work on presentations in the backseat safely.",
      location: "Noida"
    },
    {
      name: "Priyanka Joshi",
      role: "Parent & Home Maker",
      avatar: "👩‍⚕️",
      rating: 5,
      content: "We hired a permanent driver on a monthly subscription package for my children's school pickups and senior family members' transit. The consistency of service and the guarantee of a backup driver when needed is simply outstanding.",
      location: "Mumbai"
    },
    {
      name: "Vikram Malhotra",
      role: "CEO, Tech Startup",
      avatar: "👨‍🔬",
      rating: 5,
      content: "I have premium sedans and was very cautious about who drives them. The strict driver verification protocol at SearchMyDriver is what won my trust. I use them multiple times a week for my late-night meetings.",
      location: "Bengaluru"
    },
    {
      name: "Anjali Gupta",
      role: "Frequent Weekend Traveler",
      avatar: "👩‍🎨",
      rating: 5,
      content: "Outstanding outstation service! Booked a driver for our family trip to Jaipur. He arrived 15 minutes early, drove defensively, kept the speed under limits, and knew the route inside out. Will definitely book again.",
      location: "Delhi NCR"
    }
  ];

  return (
    <div className="py-16 md:py-24 bg-slate-50 relative overflow-hidden">
      <div className="absolute top-1/3 left-10 w-[450px] h-[450px] bg-amber-50/5 rounded-full blur-[110px] pointer-events-none" />
      <div className="absolute bottom-1/3 right-10 w-[350px] h-[350px] bg-blue-50/5 rounded-full blur-[90px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-20">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-slate-200 text-amber-600 text-xs font-semibold shadow-sm animate-pulse">
            <Sparkles className="w-3 h-3" /> Client Stories
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-950">
            What Our Customers Say
          </h1>
          <p className="text-slate-500 text-lg font-medium">
            Hear from car owners who rely on SearchMyDriver for a comfortable and professional driving experience every day.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {testimonials.map((test, idx) => (
            <div 
              key={idx} 
              className="bg-white border border-slate-200 p-8 rounded-3xl space-y-6 flex flex-col justify-between hover:shadow-lg transition-all hover:-translate-y-1 duration-300"
            >
              <div className="space-y-4">
                <div className="flex gap-1">
                  {[...Array(test.rating)].map((_, i) => (
                    <Star key={i} className="w-4.5 h-4.5 text-amber-500 fill-amber-500" />
                  ))}
                </div>
                <p className="text-slate-600 text-sm leading-relaxed italic font-medium">
                  "{test.content}"
                </p>
              </div>

              <div className="flex items-center gap-4 pt-6 border-t border-slate-100">
                <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center text-xl">
                  {test.avatar}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-950">{test.name}</h4>
                  <p className="text-[11px] text-slate-400 font-bold">{test.role} &bull; {test.location}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TestimonialsPage;
