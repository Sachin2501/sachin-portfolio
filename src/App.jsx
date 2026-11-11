import React, { useState, useEffect, useCallback } from 'react';
import { PortfolioProvider } from './context/PortfolioBackendContext.jsx';
import { PortfolioApp } from './portfolio-frontend/PortfolioApp.jsx';
import { AdminApp } from './admin-frontend/AdminApp.jsx';

export const App = () => {
  const [currentView, setCurrentView] = useState(() => {
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

  // Listen to hash changes (e.g. browser back/forward or #admin links)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash === '#admin') {
        setCurrentView('admin');
      } else if (hash === '#home' || hash === '' || hash.startsWith('#')) {
        // Only return to frontend if explicitly requested or on standard section anchor
        if (hash === '#home' || hash === '') {
          setCurrentView('frontend');
        }
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Keyboard shortcut Ctrl+Shift+A or Alt+A to toggle between Frontend and Admin UI
  useEffect(() => {
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

  const handleNavigateToAdmin = useCallback(() => {
    window.location.hash = '#admin';
    setCurrentView('admin');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleNavigateToFrontend = useCallback(() => {
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
