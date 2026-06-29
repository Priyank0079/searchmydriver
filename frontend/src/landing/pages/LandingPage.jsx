import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Clock, Award, Star, ArrowRight, MapPin, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ShieldCheck, Handshake, Users, Sparkles, Download } from 'lucide-react';
import api from '../../utils/api';

const LandingPage = () => {
  const navigate = useNavigate();
  const [banners, setBanners] = useState([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [cities, setCities] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [openFaqIndex, setOpenFaqIndex] = useState(null);
  const [showFullDesc, setShowFullDesc] = useState(false);

  const words = ['PROFESSIONAL DRIVER', 'CHAUFFEUR', 'HOURLY DRIVER', 'MONTHLY DRIVER'];
  const [wordIndex, setWordIndex] = useState(0);
  const [currentText, setCurrentText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let timer;
    const currentWord = words[wordIndex];
    const typingSpeed = isDeleting ? 50 : 100;

    const handleTyping = () => {
      if (!isDeleting) {
        setCurrentText(currentWord.substring(0, currentText.length + 1));
        if (currentText === currentWord) {
          timer = setTimeout(() => setIsDeleting(true), 2000);
        } else {
          timer = setTimeout(handleTyping, typingSpeed);
        }
      } else {
        setCurrentText(currentWord.substring(0, currentText.length - 1));
        if (currentText === '') {
          setIsDeleting(false);
          setWordIndex((prev) => (prev + 1) % words.length);
        } else {
          timer = setTimeout(handleTyping, typingSpeed);
        }
      }
    };

    timer = setTimeout(handleTyping, typingSpeed);
    return () => clearTimeout(timer);
  }, [currentText, isDeleting, wordIndex]);

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
    <div className="w-full bg-slate-50 text-slate-800 font-sans selection:bg-amber-500 selection:text-black">
      {/* Inline animations and custom style overrides */}
      <style>{`
        @keyframes driveIn {
          0% { transform: translate(-100%, 0) scale(0.95); opacity: 0; }
          75% { transform: translate(5%, -5px) scale(1.02); opacity: 1; }
          100% { transform: translate(0, 0) scale(1); }
        }
        @keyframes floatCar {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-4px) rotate(-0.3deg); }
        }
        @keyframes floatSlow1 {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        @keyframes floatSlow2 {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(6px); }
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-30px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(30px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes blinkCursor {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.03); }
        }
        .animate-drive-in {
          animation: driveIn 1.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-float-car {
          animation: floatCar 6s ease-in-out infinite;
          animation-delay: 1.5s;
        }
        .animate-float-1 {
          animation: floatSlow1 5s ease-in-out infinite;
        }
        .animate-float-2 {
          animation: floatSlow2 6s ease-in-out infinite;
        }
        .animate-float-3 {
          animation: floatSlow1 7s ease-in-out infinite;
        }
        .animate-slide-left {
          animation: slideInLeft 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-slide-right {
          animation: slideInRight 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-cursor {
          animation: blinkCursor 0.8s infinite;
        }
        .animate-pulse-glow {
          animation: pulseGlow 8s ease-in-out infinite;
        }
      `}</style>

      {/* Premium Re-imagined Hero Section (Light Mode & Compact) */}
      <section className="relative w-full bg-gradient-to-b from-slate-50 via-white to-slate-50/50 overflow-hidden border-b border-slate-200/80 pt-4 pb-8 lg:pt-6 lg:pb-12 flex items-start">
        {/* Warm Glow Spheres */}
        <div className="absolute top-[-20%] left-[-10%] w-[45vw] h-[45vw] bg-gradient-to-br from-amber-400/10 to-transparent rounded-full blur-[100px] pointer-events-none animate-pulse-glow" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[40vw] h-[40vw] bg-gradient-to-tr from-amber-500/10 to-transparent rounded-full blur-[90px] pointer-events-none animate-pulse-glow" style={{ animationDelay: '2s' }} />

        <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-10 grid lg:grid-cols-12 gap-8 lg:gap-6 items-start">
          
          {/* Left Column: Text, CTAs & Car Display */}
          <div className="lg:col-span-7 flex flex-col justify-center items-start space-y-6 animate-slide-left pt-2">
            {/* Tagline */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-700 text-xs font-bold tracking-wider uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
              Premium Service
            </div>

            {/* Typography */}
            <div className="space-y-2 w-full">
              <span className="block text-xs sm:text-xs font-extrabold uppercase tracking-[0.2em] text-slate-500">
                Few clicks away to book a
              </span>
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-5xl font-black tracking-tight text-slate-900 leading-[1.15] min-h-[75px] sm:min-h-[90px] lg:min-h-[110px]">
                Premium <br className="hidden sm:inline" />
                <span className="bg-gradient-to-r from-amber-500 via-orange-600 to-amber-600 bg-clip-text text-transparent">{currentText}</span>
                <span className="animate-cursor text-amber-500 ml-1">|</span> <br />
                Experience
              </h1>
              <p className="text-slate-600 text-xs sm:text-sm max-w-lg leading-relaxed">
                Book luxury rides in seconds with professional chauffeurs, transparent pricing, live tracking, and unmatched comfort.
              </p>
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap gap-3 items-center w-full">
              <button 
                onClick={() => navigate('/welcome')}
                className="group relative inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold rounded-xl shadow-[0_4px_15px_rgba(245,158,11,0.2)] hover:shadow-[0_4px_25px_rgba(245,158,11,0.35)] hover:-translate-y-0.5 transition-all duration-300 cursor-pointer text-xs tracking-wider uppercase"
              >
                <span>Book Ride</span>
                <ArrowRight className="ml-1.5 w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
              </button>
              
              <button 
                onClick={() => navigate('/welcome')}
                className="inline-flex items-center justify-center px-6 py-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold rounded-xl transition-all duration-300 cursor-pointer text-xs tracking-wider uppercase"
              >
                Download App
              </button>
            </div>

            {/* Sedan car and floating badges */}
            <div className="relative w-full pt-4 pb-2 flex items-center justify-center min-h-[150px]">
              {/* Glowing Background for Car */}
              <div className="absolute inset-0 bg-gradient-to-r from-amber-400/10 to-orange-400/5 rounded-full blur-3xl pointer-events-none scale-y-[0.3]" />
              
              {/* Main Car Image */}
              <div className="relative w-[75%] sm:w-[55%] z-20 animate-drive-in">
                <div className="animate-float-car">
                  <img
                    src="/Gemini_Generated_Image_2jf3zt2jf3zt2jf3-removebg-preview.png"
                    alt="Luxury Sedan"
                    className="w-full h-auto drop-shadow-[0_15px_30px_rgba(0,0,0,0.1)] object-contain transition-transform duration-500 hover:scale-[1.02] cursor-pointer"
                  />
                </div>
              </div>

              {/* Floating Stat Card 1 (Left) */}
              <div className="absolute top-[10%] left-[5%] z-30 animate-float-1">
                <div className="bg-white/90 backdrop-blur-md border border-slate-200/85 px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-[0_8px_16px_rgba(0,0,0,0.05)]">
                  <div className="w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                    <Star className="w-3.5 h-3.5 fill-amber-500" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-900 leading-none">4.9</p>
                    <p className="text-[8px] font-bold text-slate-500 tracking-wider uppercase leading-none mt-0.5">Rating</p>
                  </div>
                </div>
              </div>

              {/* Floating Stat Card 2 (Top Right) */}
              <div className="absolute top-[0%] right-[15%] z-30 animate-float-2">
                <div className="bg-white/90 backdrop-blur-md border border-slate-200/85 px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-[0_8px_16px_rgba(0,0,0,0.05)]">
                  <div className="w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                    <Users className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-900 leading-none">500K+</p>
                    <p className="text-[8px] font-bold text-slate-500 tracking-wider uppercase leading-none mt-0.5">Happy Riders</p>
                  </div>
                </div>
              </div>

              {/* Floating Stat Card 3 (Bottom Right) */}
              <div className="absolute bottom-[10%] right-[5%] z-30 animate-float-3">
                <div className="bg-white/90 backdrop-blur-md border border-slate-200/85 px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-[0_8px_16px_rgba(0,0,0,0.05)]">
                  <div className="w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-900 leading-none">15K+</p>
                    <p className="text-[8px] font-bold text-slate-500 tracking-wider uppercase leading-none mt-0.5">Pro Drivers</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Features Row */}
            <div className="w-full pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">100% Safe</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Verified Drivers</span>
              </div>
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Best Pricing</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">24x7 Support</span>
              </div>
            </div>
          </div>

          {/* Right Column: Premium Booking Cards Grid */}
          <div className="lg:col-span-5 flex items-start justify-center pt-2">
            <div className="grid grid-cols-2 gap-3 sm:gap-4 w-full max-w-md z-10 animate-slide-right">
              {/* Card 1: Local */}
              <div 
                onClick={() => navigate('/welcome')}
                className="group cursor-pointer bg-white border border-slate-200/60 rounded-[2rem] p-3.5 shadow-[0_8px_30px_rgba(0,0,0,0.02)] hover:shadow-[0_20px_40px_rgba(245,158,11,0.14)] hover:-translate-y-2.5 hover:ring-2 hover:ring-amber-500/20 transition-all duration-500 flex flex-col justify-between aspect-[4/5] border-b-[6px] border-b-amber-500"
              >
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-slate-50 border border-slate-200/40 shadow-inner">
                  <img src="/images/local-preview.png" alt="Local Service" className="w-full h-full object-cover transform scale-100 group-hover:scale-108 transition-all duration-700 ease-out" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/20 via-transparent to-transparent opacity-60 group-hover:opacity-30 transition-opacity duration-500" />
                  <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/95 backdrop-blur-sm shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-75 group-hover:scale-100">
                    <ArrowRight className="w-3.5 h-3.5 text-amber-600" />
                  </div>
                </div>
                <div className="text-center pt-3 pb-1 flex items-center justify-center gap-1.5">
                  <h3 className="font-black text-slate-800 group-hover:text-amber-600 text-xs sm:text-xs uppercase tracking-wider transition-all duration-300 transform group-hover:translate-x-0.5">
                    Local
                  </h3>
                  <ArrowRight className="w-3 h-3 text-amber-500 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                </div>
              </div>

              {/* Card 2: Outstation */}
              <div 
                onClick={() => navigate('/welcome')}
                className="group cursor-pointer bg-white border border-slate-200/60 rounded-[2rem] p-3.5 shadow-[0_8px_30px_rgba(0,0,0,0.02)] hover:shadow-[0_20px_40px_rgba(245,158,11,0.14)] hover:-translate-y-2.5 hover:ring-2 hover:ring-amber-500/20 transition-all duration-500 flex flex-col justify-between aspect-[4/5] border-b-[6px] border-b-amber-500"
              >
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-slate-50 border border-slate-200/40 shadow-inner">
                  <img src="/images/outstation-preview.png" alt="Outstation Service" className="w-full h-full object-cover transform scale-100 group-hover:scale-108 transition-all duration-700 ease-out" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/20 via-transparent to-transparent opacity-60 group-hover:opacity-30 transition-opacity duration-500" />
                  <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/95 backdrop-blur-sm shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-75 group-hover:scale-100">
                    <ArrowRight className="w-3.5 h-3.5 text-amber-600" />
                  </div>
                </div>
                <div className="text-center pt-3 pb-1 flex items-center justify-center gap-1.5">
                  <h3 className="font-black text-slate-800 group-hover:text-amber-600 text-xs sm:text-sm uppercase tracking-wider transition-all duration-300 transform group-hover:translate-x-0.5">
                    Outstation
                  </h3>
                  <ArrowRight className="w-3 h-3 text-amber-500 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                </div>
              </div>

              {/* Card 3: Outstation Drop */}
              <div 
                onClick={() => navigate('/welcome')}
                className="group cursor-pointer bg-white border border-slate-200/60 rounded-[2rem] p-3.5 shadow-[0_8px_30px_rgba(0,0,0,0.02)] hover:shadow-[0_20px_40px_rgba(245,158,11,0.14)] hover:-translate-y-2.5 hover:ring-2 hover:ring-amber-500/20 transition-all duration-500 flex flex-col justify-between aspect-[4/5] border-b-[6px] border-b-amber-500"
              >
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-slate-50 border border-slate-200/40 shadow-inner">
                  <img src="/images/drop-preview.png" alt="Outstation Drop" className="w-full h-full object-cover transform scale-100 group-hover:scale-108 transition-all duration-700 ease-out" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/20 via-transparent to-transparent opacity-60 group-hover:opacity-30 transition-opacity duration-500" />
                  <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/95 backdrop-blur-sm shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-75 group-hover:scale-100">
                    <ArrowRight className="w-3.5 h-3.5 text-amber-600" />
                  </div>
                </div>
                <div className="text-center pt-3 pb-1 flex items-center justify-center gap-1.5">
                  <h3 className="font-black text-slate-800 group-hover:text-amber-600 text-[10px] sm:text-xs uppercase tracking-wider transition-all duration-300 transform group-hover:translate-x-0.5">
                    Outstation Drop
                  </h3>
                  <ArrowRight className="w-3 h-3 text-amber-500 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                </div>
              </div>

              {/* Card 4: Permanent */}
              <div 
                onClick={() => navigate('/welcome')}
                className="group cursor-pointer bg-white border border-slate-200/60 rounded-[2rem] p-3.5 shadow-[0_8px_30px_rgba(0,0,0,0.02)] hover:shadow-[0_20px_40px_rgba(245,158,11,0.14)] hover:-translate-y-2.5 hover:ring-2 hover:ring-amber-500/20 transition-all duration-500 flex flex-col justify-between aspect-[4/5] border-b-[6px] border-b-amber-500"
              >
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-slate-50 border border-slate-200/40 shadow-inner">
                  <img src="/images/permanent-preview.png" alt="Permanent Driver" className="w-full h-full object-cover transform scale-100 group-hover:scale-108 transition-all duration-700 ease-out" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/20 via-transparent to-transparent opacity-60 group-hover:opacity-30 transition-opacity duration-500" />
                  <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/95 backdrop-blur-sm shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-75 group-hover:scale-100">
                    <ArrowRight className="w-3.5 h-3.5 text-amber-600" />
                  </div>
                </div>
                <div className="text-center pt-3 pb-1 flex items-center justify-center gap-1.5">
                  <h3 className="font-black text-slate-800 group-hover:text-amber-600 text-xs sm:text-sm uppercase tracking-wider transition-all duration-300 transform group-hover:translate-x-0.5">
                    Permanent
                  </h3>
                  <ArrowRight className="w-3 h-3 text-amber-500 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Hassle-free Commute Section */}
      <section className="py-16 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <div className="space-y-3 max-w-3xl mx-auto">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-950 tracking-tight leading-tight">
              Hassle-free Commute with #1 Driver Service by our Professional Drivers
            </h2>
            <div className="w-16 h-1.5 bg-amber-500 mx-auto rounded-full" />
          </div>

          <div className="max-w-3xl mx-auto space-y-3">
            <p className="text-slate-500 font-medium text-xs sm:text-sm leading-relaxed">
              Welcome to SearchMyDriver! With our driver on call service, you can say goodbye to the hassles of driving, parking, and navigating through traffic.
              {showFullDesc && (
                <span className="inline">
                  {" "}If you're looking for a driver for rent near you, we have you covered. Our mission is to provide top-notch chauffeur services that meet all your commuting needs.
                </span>
              )}
            </p>
            <button 
              onClick={() => setShowFullDesc(!showFullDesc)} 
              className="text-xs font-bold text-amber-600 hover:text-amber-500 transition-colors uppercase tracking-wider cursor-pointer"
            >
              {showFullDesc ? 'Read Less' : 'Read More...'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 max-w-5xl mx-auto pt-8">
            {/* Stat 1 */}
            <div className="bg-white border border-slate-200 border-l-[6px] border-b-[6px] border-l-amber-400 border-b-slate-900 rounded-3xl p-6 flex items-center justify-between shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 group">
              <div className="text-left space-y-1">
                <p className="text-2xl sm:text-3xl font-black text-slate-950">20000+</p>
                <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider leading-tight">
                  Police Verified Drivers
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 transition-transform group-hover:scale-110 duration-300">
                <ShieldCheck className="w-6 h-6" />
              </div>
            </div>

            {/* Stat 2 */}
            <div className="bg-white border border-slate-200 border-l-[6px] border-b-[6px] border-l-amber-400 border-b-slate-900 rounded-3xl p-6 flex items-center justify-between shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 group">
              <div className="text-left space-y-1">
                <p className="text-2xl sm:text-3xl font-black text-slate-950">5 Lac+</p>
                <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider leading-tight">
                  Happy Clients
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 transition-transform group-hover:scale-110 duration-300">
                <Users className="w-6 h-6" />
              </div>
            </div>

            {/* Stat 3 */}
            <div className="bg-white border border-slate-200 border-l-[6px] border-b-[6px] border-l-amber-400 border-b-slate-900 rounded-3xl p-6 flex items-center justify-between shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 group">
              <div className="text-left space-y-1">
                <p className="text-2xl sm:text-3xl font-black text-slate-950">1 Lac+</p>
                <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider leading-tight">
                  Permanent Drivers
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 transition-transform group-hover:scale-110 duration-300">
                <Handshake className="w-6 h-6" />
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
