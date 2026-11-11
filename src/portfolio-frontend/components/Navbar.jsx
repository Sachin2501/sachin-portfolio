import React, { useState, useEffect, useCallback, memo } from 'react';
import { personalInfo } from '../../data/portfolioData.js';
import { usePortfolioBackend } from '../../context/PortfolioBackendContext.jsx';

export const Navbar = memo(({ activeSection, onNavigate }) => {
  const { profileConfig } = usePortfolioBackend();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Throttled scroll listener using requestAnimationFrame to prevent scroll lag
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrolled = window.scrollY > 25;
          setIsScrolled((prev) => (prev !== scrolled ? scrolled : prev));
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile drawer on Escape key or resize to desktop
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsMobileMenuOpen(false);
    };
    const handleResize = () => {
      if (window.innerWidth > 1180) setIsMobileMenuOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  // Theme setup
  useEffect(() => {
    const savedTheme = localStorage.getItem('portfolio-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldBeDark = savedTheme === 'dark' || (!savedTheme && prefersDark);

    if (shouldBeDark) {
      document.body.classList.add('dark-mode');
      setIsDarkMode(true);
    } else {
      document.body.classList.remove('dark-mode');
      setIsDarkMode(false);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDarkMode((prevDark) => {
      const nextDark = !prevDark;
      if (nextDark) {
        document.body.classList.add('dark-mode');
        localStorage.setItem('portfolio-theme', 'dark');
      } else {
        document.body.classList.remove('dark-mode');
        localStorage.setItem('portfolio-theme', 'light');
      }
      return nextDark;
    });
  }, []);

  const scrollToSection = useCallback((id) => {
    // Notify parent with fromClick = true to lock active state during smooth scroll
    if (onNavigate) {
      onNavigate(id, true);
    }

    // Close mobile drawer if open
    if (isMobileMenuOpen) {
      setIsMobileMenuOpen(false);
      document.body.style.overflow = '';
    }

    if (id === 'home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const element = document.getElementById(id);
    if (element) {
      const navHeader = document.querySelector('.navbar-header');
      const headerOffset = navHeader ? navHeader.offsetHeight + 8 : 72;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: Math.max(0, offsetPosition),
        behavior: 'smooth',
      });
    }
  }, [isMobileMenuOpen, onNavigate]);

  const navItems = [
    { id: 'home', label: 'Home', icon: 'fas fa-house' },
    { id: 'about', label: 'About', icon: 'fas fa-user' },
    { id: 'experience', label: 'Experience', icon: 'fas fa-briefcase' },
    { id: 'education', label: 'Education', icon: 'fas fa-graduation-cap' },
    { id: 'certifications', label: 'Certifications', icon: 'fas fa-certificate' },
    { id: 'skills', label: 'Skills', icon: 'fas fa-code' },
    { id: 'projects', label: 'Projects', icon: 'fas fa-laptop-code' },
    { id: 'github-contributions', label: 'Activity', icon: 'fab fa-github' },
    { id: 'contact', label: 'Contact', icon: 'fas fa-envelope' },
  ];

  return (
    <>
      <header className={`navbar-header ${isScrolled ? 'scrolled' : ''}`}>
        <div className="container">
          <nav className="navbar-nav">
            {/* Brand Logo & Monogram */}
            <div
              className="brand-logo"
              onClick={() => scrollToSection('home')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') scrollToSection('home');
              }}
              title="Sachin Kumar - Home"
            >
              <div className="brand-monogram">
                <img
                  src={profileConfig?.logoImage || personalInfo.logoImage || '/assets/aistudio/Gemini_Generated_Image_hizeznhizeznhize_739e79f3.png'}
                  alt={`${personalInfo.name} SK Logo`}
                  className="brand-logo-badge-img"
                  loading="eager"
                />
              </div>
              <div className="brand-details">
                <span className="brand-name">{personalInfo.name}</span>
                <span className="brand-status">
                  <span className="status-pulse-dot" />
                  Available for hire
                </span>
              </div>
            </div>

            {/* Desktop Navigation Links */}
            <ul className="nav-links desktop-nav" role="menubar">
              {navItems.map((item) => {
                const isActive = activeSection === item.id;
                return (
                  <li key={item.id} role="none">
                    <button
                      type="button"
                      role="menuitem"
                      className={`nav-link-btn ${isActive ? 'active' : ''}`}
                      onClick={() => scrollToSection(item.id)}
                      aria-current={isActive ? 'true' : 'false'}
                    >
                      <span>{item.label}</span>
                      {isActive && <span className="active-dot-indicator" />}
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* Right Header Actions */}
            <div className="nav-actions">
              {/* Theme Toggle Button */}
              <button
                type="button"
                className="theme-toggle-btn"
                onClick={toggleTheme}
                aria-label={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                <i className={`fas ${isDarkMode ? 'fa-sun' : 'fa-moon'}`}></i>
              </button>


              {/* Direct Contact CTA Button */}
              <button
                type="button"
                className="nav-cta-btn"
                onClick={() => scrollToSection('contact')}
              >
                <span>Let's Talk</span>
                <i className="fas fa-arrow-right"></i>
              </button>

              {/* Mobile Hamburger Toggle Button */}
              <button
                type="button"
                className={`hamburger-btn ${isMobileMenuOpen ? 'open' : ''}`}
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                aria-expanded={isMobileMenuOpen}
              >
                <span className="hamburger-bar" />
                <span className="hamburger-bar" />
                <span className="hamburger-bar" />
              </button>
            </div>
          </nav>
        </div>
      </header>

      {/* Mobile Drawer Menu & Overlay */}
      {isMobileMenuOpen && (
        <div
          className="mobile-nav-backdrop"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`mobile-nav-drawer ${isMobileMenuOpen ? 'open' : ''}`}
        aria-hidden={!isMobileMenuOpen}
        aria-label="Mobile Navigation Drawer"
      >
        <div className="mobile-drawer-header">
          <div
            className="brand-logo"
            onClick={() => scrollToSection('home')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') scrollToSection('home');
            }}
          >
            <div className="brand-monogram">
              <img
                src={profileConfig?.logoImage || personalInfo.logoImage || '/assets/aistudio/Gemini_Generated_Image_hizeznhizeznhize_739e79f3.png'}
                alt={`${personalInfo.name} SK Logo`}
                className="brand-logo-badge-img"
                loading="eager"
              />
            </div>
            <div className="brand-details">
              <span className="brand-name">{personalInfo.name}</span>
              <span className="brand-status">
                <span className="status-pulse-dot" />
                Available for hire
              </span>
            </div>
          </div>
          <button
            type="button"
            className="mobile-drawer-close"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="Close navigation menu"
          >
            ✕
          </button>
        </div>

        <ul className="mobile-nav-list">
          {navItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={`mobile-nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => scrollToSection(item.id)}
                >
                  <i className={`${item.icon} mobile-nav-icon`}></i>
                  <span>{item.label}</span>
                  {isActive && <span className="mobile-active-pill">Current</span>}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mobile-drawer-footer">
          <button
            type="button"
            className="mobile-drawer-theme-btn"
            onClick={toggleTheme}
          >
            <i className={`fas ${isDarkMode ? 'fa-sun' : 'fa-moon'}`}></i>
            <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
          <button
            type="button"
            className="btn nav-drawer-cta"
            onClick={() => scrollToSection('contact')}
          >
            <span>Get In Touch</span>
            <i className="fas fa-paper-plane" style={{ marginLeft: '8px' }}></i>
          </button>
        </div>
      </aside>
    </>
  );
});

export default Navbar;
