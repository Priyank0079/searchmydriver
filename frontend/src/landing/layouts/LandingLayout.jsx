import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const LandingLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <div className="min-h-screen w-full bg-slate-50 text-slate-900 font-sans selection:bg-amber-500 selection:text-black flex flex-col justify-between">
      {/* Header / Navbar */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/80 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <img src="/images/logo-smd.png" alt="SearchMyDriver" className="h-12 w-auto object-contain" />
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold">
            <button
              onClick={() => navigate('/')}
              className={`transition-colors cursor-pointer ${isActive('/') ? 'text-amber-500 font-bold' : 'text-slate-600 hover:text-amber-500'}`}
            >
              Home
            </button>
            <button
              onClick={() => navigate('/how-it-works')}
              className={`transition-colors cursor-pointer ${isActive('/how-it-works') ? 'text-amber-500 font-bold' : 'text-slate-600 hover:text-amber-500'}`}
            >
              How It Works
            </button>
            <button
              onClick={() => navigate('/services')}
              className={`transition-colors cursor-pointer ${isActive('/services') ? 'text-amber-500 font-bold' : 'text-slate-600 hover:text-amber-500'}`}
            >
              Services
            </button>
            <button
              onClick={() => navigate('/testimonials')}
              className={`transition-colors cursor-pointer ${isActive('/testimonials') ? 'text-amber-500 font-bold' : 'text-slate-600 hover:text-amber-500'}`}
            >
              Testimonials
            </button>
            <button
              onClick={() => navigate('/support')}
              className={`transition-colors cursor-pointer ${isActive('/support') ? 'text-amber-500 font-bold' : 'text-slate-600 hover:text-amber-500'}`}
            >
              Support
            </button>
          </nav>

          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/driver/login')}
              className="hidden sm:inline-flex items-center text-sm font-bold text-amber-600 hover:text-amber-500 transition-colors px-4 py-2"
            >
              Become a Driver
            </button>
            <button
              onClick={() => navigate('/welcome')}
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-extrabold text-sm hover:from-amber-400 hover:to-yellow-300 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-md shadow-amber-500/10"
            >
              Book a Driver <ArrowRight className="ml-2 w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Page Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <img src="/images/logo-smd.png" alt="SearchMyDriver" className="h-8 w-auto object-contain" />
          </div>
          <p className="text-slate-500 text-xs font-medium">
            &copy; {new Date().getFullYear()} SearchMyDriver. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingLayout;
