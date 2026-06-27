import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Clock, Award, Star, ArrowRight, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../../utils/api';

const LandingPage = () => {
  const navigate = useNavigate();
  const [banners, setBanners] = useState([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [cities, setCities] = useState([]);

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
      {/* Hero Section */}
      <section className="relative pt-12 pb-24 overflow-hidden lg:pt-20 lg:pb-32">
        {/* Ambient background glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-500/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-1/2 right-10 w-[300px] h-[300px] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left Col: Text & CTA */}
            <div className="lg:col-span-7 space-y-8 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-700 text-xs font-semibold shadow-sm">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Trusted by 10,000+ Car Owners
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-none text-slate-950">
                Your Luxury Car.<br />
                <span className="bg-gradient-to-r from-amber-600 to-yellow-500 bg-clip-text text-transparent">
                  Our Professional Driver.
                </span>
              </h1>

              <p className="text-slate-600 text-lg sm:text-xl max-w-2xl mx-auto lg:mx-0 font-normal leading-relaxed">
                Hire highly trained, background-verified, and professional drivers hourly, monthly, or for outstation trips. Experience safe, secure, and stress-free travel.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <button
                  onClick={() => navigate('/welcome')}
                  className="inline-flex items-center justify-center px-8 py-4 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-extrabold text-base hover:from-amber-400 hover:to-yellow-300 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-amber-500/20"
                >
                  Get Started <ArrowRight className="ml-2 w-5 h-5" />
                </button>
                <button
                  onClick={() => navigate('/driver/login')}
                  className="inline-flex items-center justify-center px-8 py-4 rounded-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-bold text-base transition-all shadow-sm"
                >
                  Join as Partner Driver
                </button>
              </div>

              {/* Trust markers */}
              <div className="grid grid-cols-3 gap-4 pt-6 max-w-md mx-auto lg:mx-0 border-t border-slate-200">
                <div>
                  <div className="text-2xl font-black text-slate-950">4.9/5</div>
                  <div className="text-xs text-slate-500 font-medium">Customer Rating</div>
                </div>
                <div>
                  <div className="text-2xl font-black text-slate-950">500+</div>
                  <div className="text-xs text-slate-500 font-medium">Verified Drivers</div>
                </div>
                <div>
                  <div className="text-2xl font-black text-slate-950">100%</div>
                  <div className="text-xs text-slate-500 font-medium">Safe & Insured</div>
                </div>
              </div>
            </div>

            {/* Right Col: Interactive visual card or promo */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="relative w-full max-w-[420px] aspect-[4/5] bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xl flex flex-col justify-between overflow-hidden group">
                {/* Glowing effect on hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-yellow-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                {/* Simulated Screen Header */}
                <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs">🚗</div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Active Booking</h4>
                      <p className="text-[10px] text-slate-400">Scheduled on time</p>
                    </div>
                  </div>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full font-bold">Assigned</span>
                </div>

                {/* Simulated Driver Profile */}
                <div className="my-auto space-y-6 py-6">
                  <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-lg font-bold text-amber-500">
                      👨‍✈️
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-bold flex items-center gap-1.5 text-slate-900">
                        Vikram Singh <span className="text-xs text-amber-600 flex items-center"><Star className="w-3 h-3 fill-amber-500" /> 4.95</span>
                      </h3>
                      <p className="text-xs text-slate-400 font-medium">Professional (7+ yrs exp)</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex gap-3 text-xs text-slate-600">
                      <MapPin className="w-4 h-4 text-amber-500 shrink-0" />
                      <div>
                        <p className="font-bold text-slate-950">Pickup Location</p>
                        <p className="text-slate-500">Connaught Place, New Delhi</p>
                      </div>
                    </div>
                    <div className="flex gap-3 text-xs text-slate-600">
                      <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                      <div>
                        <p className="font-bold text-slate-950">Service Selected</p>
                        <p className="text-slate-500">Hourly Booking (4 hrs slab)</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Simulated CTA buttons */}
                <div className="space-y-2 mt-auto">
                  <button onClick={() => navigate('/welcome')} className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs rounded-xl transition-all shadow-sm">
                    Book Now
                  </button>
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
                  <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center transition-all group-hover:scale-105 group-hover:shadow-md">
                    <img 
                      src={city.imageUrl} 
                      alt={city.name} 
                      className="w-10 h-10 object-contain"
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
