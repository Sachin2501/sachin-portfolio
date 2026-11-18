import React, { useState, useEffect, useCallback } from 'react';
import { PortfolioProvider } from './context/PortfolioBackendContext.jsx';
import { PortfolioApp } from './portfolio-frontend/PortfolioApp.jsx';
import { AdminApp } from './admin-frontend/AdminApp.jsx';

// Deployment Mode Configuration:
// - 'portfolio' / 'frontend': Locks deployment exclusively to the public Portfolio Frontend (for Portfolio Vercel project)
// - 'admin' / 'admin-frontend': Locks deployment exclusively to the Admin Control Panel (for Admin Vercel project)
// - 'both' (default): Unified mode supporting both views via /admin, #admin, or Ctrl+Shift+A
const RAW_APP_MODE = (import.meta.env.VITE_APP_MODE || 'both').toLowerCase().trim();
const IS_ADMIN_ONLY = RAW_APP_MODE === 'admin' || RAW_APP_MODE === 'admin-frontend' || RAW_APP_MODE === 'admin-only';
const IS_PORTFOLIO_ONLY =
  RAW_APP_MODE === 'portfolio' ||
  RAW_APP_MODE === 'frontend' ||
  RAW_APP_MODE === 'portfolio-frontend' ||
  RAW_APP_MODE === 'portfolio-only';
const PUBLIC_PORTFOLIO_URL = (import.meta.env.VITE_PORTFOLIO_PUBLIC_URL || '').trim();

export const App = () => {
  const [currentView, setCurrentView] = useState(() => {
    if (IS_ADMIN_ONLY) return 'admin';
    if (IS_PORTFOLIO_ONLY) return 'frontend';

    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname.toLowerCase();
      const hash = window.location.hash.toLowerCase();
      const params = new URLSearchParams(window.location.search);
      if (
        pathname === '/admin' ||
        pathname.startsWith('/admin/') ||
        hash === '#admin' ||
        params.get('view') === 'admin'
      ) {
        return 'admin';
      }
    }
    return 'frontend';
  });

  // Listen to hash changes when running in unified ('both') mode
  useEffect(() => {
    if (IS_ADMIN_ONLY || IS_PORTFOLIO_ONLY) return undefined;

    const handleHashChange = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash === '#admin') {
        setCurrentView('admin');
      } else if (hash === '#home' || hash === '' || hash.startsWith('#')) {
        if (hash === '#home' || hash === '') {
          setCurrentView('frontend');
        }
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Keyboard shortcut Ctrl+Shift+A or Alt+A to toggle between Frontend and Admin UI (only in 'both' mode)
  useEffect(() => {
    if (IS_ADMIN_ONLY || IS_PORTFOLIO_ONLY) return undefined;

    const handleKeyDown = (e) => {
      if (
        (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') ||
        (e.altKey && e.key.toLowerCase() === 'a')
      ) {
        e.preventDefault();
        setCurrentView((prev) => {
          const next = prev === 'admin' ? 'frontend' : 'admin';
          window.location.hash = next === 'admin' ? '#admin' : '#home';
          return next;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleNavigateToFrontend = useCallback(() => {
    // If deployed as a standalone Admin project and VITE_PORTFOLIO_PUBLIC_URL is set, navigate there
    if (IS_ADMIN_ONLY && PUBLIC_PORTFOLIO_URL) {
      window.location.href = PUBLIC_PORTFOLIO_URL;
      return;
    }
    window.location.hash = '#home';
    setCurrentView('frontend');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <PortfolioProvider>
      {currentView === 'admin' ? (
        <AdminApp onNavigateToFrontend={handleNavigateToFrontend} />
      ) : (
        <PortfolioApp />
      )}
    </PortfolioProvider>
  );
};

export default App;

