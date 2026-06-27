import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight, Menu, X } from 'lucide-react';

const LandingLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (path) => location.pathname === path;

  const navLinks = [
    { path: '/', label: 'Home' },
    { path: '/how-it-works', label: 'How It Works' },
    { path: '/services', label: 'Services' },
    { path: '/testimonials', label: 'Testimonials' },
    { path: '/support', label: 'Support' },
  ];

  const handleNavigate = (path) => {
    navigate(path);
    setMenuOpen(false);
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 text-slate-900 font-sans selection:bg-amber-500 selection:text-black flex flex-col justify-between">
      {/* Header / Navbar */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/80 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleNavigate('/')}>
            <img src="/images/logo-smd.png" alt="SearchMyDriver" className="h-12 w-auto object-contain" />
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold">
            {navLinks.map((link) => (
              <button
                key={link.path}
                onClick={() => handleNavigate(link.path)}
                className={`transition-colors cursor-pointer ${
                  isActive(link.path) ? 'text-amber-500 font-bold' : 'text-slate-600 hover:text-amber-500'
                }`}
              >
                {link.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => handleNavigate('/driver/login')}
              className="hidden sm:inline-flex items-center text-sm font-bold text-amber-600 hover:text-amber-500 transition-colors px-4 py-2"
            >
              Become a Driver
            </button>
            <button
              onClick={() => handleNavigate('/welcome')}
              className="inline-flex items-center justify-center px-4 py-2.5 sm:px-5 sm:py-2.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-extrabold text-xs sm:text-sm hover:from-amber-400 hover:to-yellow-300 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-md shadow-amber-500/10"
            >
              Book a Driver <ArrowRight className="ml-1.5 sm:ml-2 w-4 h-4" />
            </button>

            {/* Mobile Hamburger toggle */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-700 md:hidden transition-colors cursor-pointer"
              aria-label="Toggle menu"
            >
              {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown Menu */}
        {menuOpen && (
          <div className="md:hidden bg-white border-t border-slate-200 py-4 px-6 flex flex-col gap-4 animate-fade-in shadow-lg">
            {navLinks.map((link) => (
              <button
                key={link.path}
                onClick={() => handleNavigate(link.path)}
                className={`text-left text-sm font-bold py-2.5 transition-colors ${
                  isActive(link.path) ? 'text-amber-500' : 'text-slate-600 hover:text-amber-500'
                }`}
              >
                {link.label}
              </button>
            ))}
            <button
              onClick={() => handleNavigate('/driver/login')}
              className="text-left text-sm font-bold py-2.5 text-amber-600 hover:text-amber-500 border-t border-slate-100 pt-3"
            >
              Become a Driver
            </button>
          </div>
        )}
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
