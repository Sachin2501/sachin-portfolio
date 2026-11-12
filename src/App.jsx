import React, { useState, useEffect, useCallback } from 'react';
import { PortfolioProvider } from './context/PortfolioBackendContext.jsx';
import { PortfolioApp } from './portfolio-frontend/PortfolioApp.jsx';
import { AdminApp } from './admin-frontend/AdminApp.jsx';

// Deployment Mode Configuration:
// - 'portfolio': Locks deployment exclusively to the public Portfolio Frontend (for Portfolio Vercel project)
// - 'admin': Locks deployment exclusively to the Admin Control Panel (for Admin Vercel project)
// - 'both' (default): Unified mode supporting both views via /admin, #admin, or Ctrl+Shift+A
const APP_MODE = (import.meta.env.VITE_APP_MODE || 'both').toLowerCase().trim();
const PUBLIC_PORTFOLIO_URL = (import.meta.env.VITE_PORTFOLIO_PUBLIC_URL || '').trim();

export const App = () => {
  const [currentView, setCurrentView] = useState(() => {
    if (APP_MODE === 'admin') return 'admin';
    if (APP_MODE === 'portfolio') return 'frontend';

    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname.toLowerCase();
      const hash = window.location.hash.toLowerCase();
      const params = new URLSearchParams(window.location.search);
      if (pathname === '/admin' || hash === '#admin' || params.get('view') === 'admin') {
        return 'admin';
      }
    }
    return 'frontend';
  });

  // Listen to hash changes when running in unified ('both') mode
  useEffect(() => {
    if (APP_MODE === 'admin' || APP_MODE === 'portfolio') return undefined;

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
    if (APP_MODE === 'admin' || APP_MODE === 'portfolio') return undefined;

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
    if (APP_MODE === 'admin' && PUBLIC_PORTFOLIO_URL) {
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

