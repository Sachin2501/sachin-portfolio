import React, { useState, memo } from 'react';

export const SideDotNav = memo(({ activeSection, onNavigate }) => {
  const [hoveredSection, setHoveredSection] = useState(null);

  const sections = [
    { id: 'home', label: 'Home' },
    { id: 'about', label: 'About' },
    { id: 'experience', label: 'Experience' },
    { id: 'education', label: 'Education' },
    { id: 'certifications', label: 'Certifications' },
    { id: 'skills', label: 'Skills' },
    { id: 'projects', label: 'Projects' },
    { id: 'github-contributions', label: 'Activity' },
    { id: 'contact', label: 'Contact' },
  ];

  const scrollToSection = (id) => {
    if (onNavigate) {
      onNavigate(id, true);
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
  };

  return (
    <nav className="side-dot-nav" aria-label="Quick page section navigation">
      <ul className="side-dot-list">
        {sections.map((item) => {
          const isActive = activeSection === item.id;
          const isHovered = hoveredSection === item.id;

          return (
            <li key={item.id} className="side-dot-item">
              <button
                type="button"
                className={`side-dot-btn ${isActive ? 'active' : ''}`}
                onClick={() => scrollToSection(item.id)}
                onMouseEnter={() => setHoveredSection(item.id)}
                onMouseLeave={() => setHoveredSection(null)}
                aria-label={`Jump to ${item.label} section`}
                aria-current={isActive ? 'true' : 'false'}
              >
                <span className="side-dot-circle" />

                {/* Tooltip Label */}
                <span
                  className={`side-dot-tooltip ${
                    isHovered || isActive ? 'visible' : ''
                  }`}
                  aria-hidden={!isHovered && !isActive}
                >
                  {item.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
});

export default SideDotNav;
