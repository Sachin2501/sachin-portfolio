import React, { useState, useEffect } from 'react';

export const QuickContact = ({ activeSection }) => {
  const [isNearContact, setIsNearContact] = useState(false);

  useEffect(() => {
    const contactEl = document.getElementById('contact');
    if (!contactEl) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsNearContact(entry.isIntersecting);
        });
      },
      {
        root: null,
        rootMargin: '0px 0px -25% 0px',
        threshold: 0.15,
      }
    );

    observer.observe(contactEl);
    return () => observer.disconnect();
  }, []);

  const scrollToContact = () => {
    const element = document.getElementById('contact');
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

  const isContactActive = activeSection === 'contact';
  const isHidden = isNearContact || isContactActive;

  return (
    <button
      type="button"
      className={`quick-contact-btn ${isHidden ? 'hidden' : 'visible'}`}
      onClick={scrollToContact}
      aria-label="Quick Contact - Scroll directly to contact section"
      title="Quick Contact"
    >
      <span className="quick-contact-icon-wrapper" aria-hidden="true">
        <i className="fas fa-paper-plane"></i>
        <span className="quick-contact-pulse-dot" />
      </span>
      <span className="quick-contact-tooltip" role="tooltip">Quick Contact</span>
    </button>
  );
};

export default QuickContact;
