import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Clock, Award, Star, ArrowRight, MapPin, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../../utils/api';

const LandingPage = () => {
  const navigate = useNavigate();
  const [banners, setBanners] = useState([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [cities, setCities] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [openFaqIndex, setOpenFaqIndex] = useState(null);

  useEffect(() => {
    const fetchFaqs = async () => {
      try {
        const res = await api.get('/web-faqs/common');
        if (res.data?.data) {
          setFaqs(res.data.data);
        }
      } catch (err) {
        console.error('Failed to fetch FAQs:', err);
      }
    };
    fetchFaqs();
  }, []);

  useEffect(() => {
    const fetchCities = async () => {
      try {
        const res = await api.get('/web-cities/common');
        if (res.data?.data) {
          setCities(res.data.data);
        }
      } catch (err) {
        console.error('Failed to fetch cities:', err);
      }
    };
    fetchCities();
  }, []);

  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const res = await api.get('/banners/common?type=web');
        if (res.data?.data && res.data.data.length > 0) {
          setBanners(res.data.data);
        } else {
          setBanners([
            {
              _id: 'default',
              title: 'Professional Driver Service',
              imageUrl: '/images/smd_banner_image.png',
              linkUrl: '/welcome'
            }
          ]);
        }
      } catch (err) {
        console.error('Failed to fetch banners:', err);
        setBanners([
          {
            _id: 'default',
            title: 'Professional Driver Service',
            imageUrl: '/images/smd_banner_image.png',
            linkUrl: '/welcome'
          }
        ]);
      }
    };
    fetchBanners();
  }, []);

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [banners]);

  return (
    <div className="w-full bg-slate-50 text-slate-900 font-sans selection:bg-amber-500 selection:text-black">
      {/* Inline animations and custom clip-paths */}
      <style>{`
        @keyframes floatCar {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(-0.5deg); }
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-50px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(50px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-float-car {
          animation: floatCar 6s ease-in-out infinite;
        }
        .animate-slide-left {
          animation: slideInLeft 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-slide-right {
          animation: slideInRight 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .yellow-clip {
          clip-path: polygon(0 0, 100% 0, 78% 100%, 0% 100%);
        }
        @media (max-width: 1024px) {
          .yellow-clip {
            clip-path: polygon(0 0, 100% 0, 100% 90%, 0% 100%);
          }
        }
      `}</style>

      {/* Recreated Dynamic Hero Section */}
      <section className="relative w-full bg-white overflow-hidden border-b border-slate-100 min-h-[580px] lg:min-h-[640px] flex items-center">
        <div className="absolute inset-0 grid lg:grid-cols-12">
          {/* Left Angle Yellow Block */}
          <div className="lg:col-span-7 bg-gradient-to-r from-amber-400 to-amber-500 yellow-clip relative flex flex-col justify-center px-6 sm:px-12 lg:px-20 pt-16 pb-28 lg:py-0 min-h-[360px] lg:min-h-full">
            <div className="space-y-6 z-10 animate-slide-left">
              <span className="inline-block text-xs sm:text-sm font-extrabold uppercase tracking-[0.2em] text-slate-900 bg-white/20 px-3 py-1 rounded-full">
                Few clicks away to book a
              </span>
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight text-slate-950 flex flex-col">
                <span className="bg-slate-950 text-amber-400 px-4 py-2 inline-block rounded-xl shadow-lg border border-slate-900 max-w-max uppercase tracking-wider">
                  Driver
                </span>
              </h1>
              <p className="text-slate-950 text-sm sm:text-base font-semibold max-w-md leading-relaxed opacity-90">
                Safe, background-verified, and professional driver partners at your service hourly or monthly.
              </p>
            </div>

            {/* Floating Sedan Image */}
            <div className="absolute bottom-4 left-6 sm:left-12 lg:left-16 w-[75%] sm:w-[50%] lg:w-[70%] z-20 animate-float-car">
              <img
                src="/Gemini_Generated_Image_2jf3zt2jf3zt2jf3-removebg-preview.png"
                alt="Yellow Luxury Sedan"
                className="w-full h-auto drop-shadow-[0_20px_35px_rgba(0,0,0,0.25)] object-contain"
              />
            </div>
          </div>

          {/* Right Cards Grid Block */}
          <div className="lg:col-span-5 flex items-center justify-center p-6 sm:p-12 lg:p-8 bg-slate-50/50">
            <div className="grid grid-cols-2 gap-4 sm:gap-6 w-full max-w-lg z-10 animate-slide-right">
              {/* Card 1: Local */}
              <div 
                onClick={() => navigate('/welcome')}
                className="group cursor-pointer bg-white border border-slate-200 rounded-3xl p-3 sm:p-4 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between aspect-[4/5]"
              >
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-slate-100 border border-slate-100">
                  <img src="/images/local-preview.png" alt="Local Service" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="text-center pt-3 border-b-4 border-transparent group-hover:border-amber-500 pb-1.5 transition-all">
                  <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm uppercase tracking-wider">Local</h3>
                </div>
              </div>

              {/* Card 2: Outstation */}
              <div 
                onClick={() => navigate('/welcome')}
                className="group cursor-pointer bg-white border border-slate-200 rounded-3xl p-3 sm:p-4 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between aspect-[4/5]"
              >
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-slate-100 border border-slate-100">
                  <img src="/images/outstation-preview.png" alt="Outstation Service" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="text-center pt-3 border-b-4 border-transparent group-hover:border-amber-500 pb-1.5 transition-all">
                  <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm uppercase tracking-wider">Outstation</h3>
                </div>
              </div>

              {/* Card 3: Outstation Drop */}
              <div 
                onClick={() => navigate('/welcome')}
                className="group cursor-pointer bg-white border border-slate-200 rounded-3xl p-3 sm:p-4 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between aspect-[4/5]"
              >
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-slate-100 border border-slate-100">
                  <img src="/images/drop-preview.png" alt="Outstation Drop" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="text-center pt-3 border-b-4 border-transparent group-hover:border-amber-500 pb-1.5 transition-all">
                  <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm uppercase tracking-wider">Drop</h3>
                </div>
              </div>

              {/* Card 4: Permanent */}
              <div 
                onClick={() => navigate('/welcome')}
                className="group cursor-pointer bg-white border border-slate-200 rounded-3xl p-3 sm:p-4 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between aspect-[4/5]"
              >
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-slate-100 border border-slate-100">
                  <img src="/images/permanent-preview.png" alt="Permanent Driver" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="text-center pt-3 border-b-4 border-transparent group-hover:border-amber-500 pb-1.5 transition-all">
                  <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm uppercase tracking-wider">Permanent</h3>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Promotional Web Banners Section */}
      {banners.length > 0 && (
        <section className="py-8 bg-white border-y border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="relative rounded-2xl overflow-hidden shadow-md aspect-[21/9] md:aspect-[32/10] bg-slate-900 group">
              <div 
                className="flex transition-transform duration-700 ease-in-out h-full"
                style={{ transform: `translateX(-${currentSlide * 100}%)` }}
              >
                {banners.map((banner) => (
                  <div 
                    key={banner._id} 
                    className="w-full shrink-0 h-full relative cursor-pointer"
                    onClick={() => banner.linkUrl && navigate(banner.linkUrl)}
                  >
                    <img 
                      src={banner.imageUrl} 
                      alt={banner.title || 'Banner'} 
                      className="w-full h-full object-cover"
                    />
                    {banner.title && (
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent flex flex-col justify-end p-6 md:p-12">
                        <h3 className="text-xl md:text-3xl font-extrabold text-white">{banner.title}</h3>
                        <p className="text-amber-400 text-xs md:text-sm font-bold mt-1.5 flex items-center gap-1.5">
                          Book Now <ArrowRight className="w-4 h-4" />
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {banners.length > 1 && (
                <>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentSlide((prev) => (prev - 1 + banners.length) % banners.length);
                    }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/50 text-white hover:bg-black/80 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentSlide((prev) => (prev + 1) % banners.length);
                    }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/50 text-white hover:bg-black/80 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Cities We Cater Section */}
      {cities.length > 0 && (
        <section className="py-16 bg-slate-50 border-t border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-12">
            <div className="space-y-3">
              <h2 className="text-3xl font-extrabold text-slate-950">Cities We Cater</h2>
              <p className="text-sm text-slate-500 font-medium max-w-lg mx-auto">
                We are committed to providing the best possible services in all cities.
              </p>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-8 justify-center items-center">
              {cities.map((city) => (
                <div key={city._id} className="flex flex-col items-center gap-3 group">
                  <div className="w-24 h-24 rounded-full bg-white border border-slate-200 shadow-sm overflow-hidden flex items-center justify-center transition-all group-hover:scale-105 group-hover:shadow-md">
                    <img 
                      src={city.imageUrl} 
                      alt={city.name} 
                      className="w-full h-full object-cover rounded-full"
                    />
                  </div>
                  <span className="text-sm font-semibold text-slate-800 capitalize transition-colors group-hover:text-amber-600">
                    {city.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Features Overview */}
      <section className="py-20 border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-950">
              Why SearchMyDriver?
            </h2>
            <p className="text-slate-500 font-medium">
              We specialize in offering top-notch driver services tailored to your vehicle and schedule.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mt-16">
            <div className="bg-slate-50 border border-slate-200 p-8 rounded-2xl space-y-4 hover:border-amber-500/20 hover:bg-white hover:shadow-lg transition-all">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-950">Strict Verification</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                All drivers undergo rigorous background checks, driving test evaluations, and identity checks before getting active on our platform.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-8 rounded-2xl space-y-4 hover:border-amber-500/20 hover:bg-white hover:shadow-lg transition-all">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-950">On-Time & Flexible</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Our drivers are strictly punctual. Book on-demand, schedule in advance, or secure regular monthly subscription drivers.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-8 rounded-2xl space-y-4 hover:border-amber-500/20 hover:bg-white hover:shadow-lg transition-all">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                <Award className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-950">Premium Experience</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Enjoy your ride while listening to music, attending calls, or working. We prioritize comfort, safety, and respect.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Frequently Asked Questions Section */}
      {faqs.length > 0 && (
        <section className="py-20 bg-slate-50 border-t border-slate-200">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-12">
            <div className="space-y-3">
              <h2 className="text-3xl font-extrabold text-slate-950">Frequently Asked Questions</h2>
              <div className="w-16 h-1 bg-emerald-500 mx-auto rounded-full" />
            </div>

            <div className="text-left space-y-4 max-w-3xl mx-auto">
              {faqs.map((faq, index) => {
                const isOpen = openFaqIndex === index;
                return (
                  <div 
                    key={faq._id} 
                    className="bg-white border border-slate-200 rounded-2xl overflow-hidden transition-all duration-200 shadow-sm"
                  >
                    <button
                      onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                      className="w-full px-6 py-5 flex items-center justify-between gap-4 text-slate-900 font-bold text-sm sm:text-base hover:bg-slate-50/50 transition-colors text-left"
                    >
                      <span>{faq.question}</span>
                      {isOpen ? (
                        <ChevronUp className="w-5 h-5 text-slate-400 shrink-0" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />
                      )}
                    </button>
                    {isOpen && (
                      <div className="px-6 pb-5 text-sm text-slate-500 font-medium leading-relaxed border-t border-slate-100 pt-4 bg-slate-50/20">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* App Download Banner */}
      <section className="py-16 bg-gradient-to-r from-emerald-600 to-teal-700 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-8">
          <h2 className="text-3xl font-extrabold text-white tracking-tight">
            Download SearchMyDriver App
          </h2>
          <p className="text-emerald-100 max-w-xl mx-auto text-sm sm:text-base font-medium">
            Get the full mobile experience. Book drivers on the go, track live locations, manage payments, and more.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-2">
            {/* User App */}
            <a
              href="/welcome"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-4 bg-black text-white px-8 py-3.5 rounded-full hover:bg-black/95 transition-all border border-emerald-500/25 shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <svg className="w-7 h-7 fill-current" viewBox="0 0 24 24">
                <path d="M18.71,19.5C17.88,20.74 17,21.95 15.66,21.97C14.32,22 13.89,21.18 12.37,21.18C10.84,21.18 10.37,21.95 9.1,22C7.79,22.05 6.8,20.68 5.96,19.47C4.25,17 2.94,12.45 4.7,9.39C5.57,7.87 7.13,6.91 8.82,6.88C10.1,6.86 11.32,7.75 12.11,7.75C12.89,7.75 14.37,6.68 15.92,6.84C16.57,6.87 18.39,7.1 19.56,8.82C19.47,8.88 17.39,10.1 17.41,12.63C17.44,15.65 20.06,16.66 20.1,16.67C20.08,16.74 19.67,18.11 18.71,19.5M15.97,4.17C16.63,3.37 17.07,2.28 16.95,1C16,1.04 14.9,1.6 14.24,2.38C13.68,3.04 13.19,4.14 13.34,5.39C14.39,5.47 15.4,4.88 15.97,4.17Z" />
              </svg>
              <div className="text-left">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">User App</p>
                <p className="text-lg font-black leading-tight">App Store</p>
              </div>
            </a>

            {/* Driver App */}
            <a
              href="/driver/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-4 bg-black text-white px-8 py-3.5 rounded-full hover:bg-black/95 transition-all border border-emerald-500/25 shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <svg className="w-7 h-7 fill-current" viewBox="0 0 24 24">
                <path d="M18.71,19.5C17.88,20.74 17,21.95 15.66,21.97C14.32,22 13.89,21.18 12.37,21.18C10.84,21.18 10.37,21.95 9.1,22C7.79,22.05 6.8,20.68 5.96,19.47C4.25,17 2.94,12.45 4.7,9.39C5.57,7.87 7.13,6.91 8.82,6.88C10.1,6.86 11.32,7.75 12.11,7.75C12.89,7.75 14.37,6.68 15.92,6.84C16.57,6.87 18.39,7.1 19.56,8.82C19.47,8.88 17.39,10.1 17.41,12.63C17.44,15.65 20.06,16.66 20.1,16.67C20.08,16.74 19.67,18.11 18.71,19.5M15.97,4.17C16.63,3.37 17.07,2.28 16.95,1C16,1.04 14.9,1.6 14.24,2.38C13.68,3.04 13.19,4.14 13.34,5.39C14.39,5.47 15.4,4.88 15.97,4.17Z" />
              </svg>
              <div className="text-left">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Driver App</p>
                <p className="text-lg font-black leading-tight">App Store</p>
              </div>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
