import React, { useState, useEffect, memo } from 'react';

export const BackToTop = memo(() => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const nextVisible = window.scrollY > 350;
          setVisible((prev) => (prev !== nextVisible ? nextVisible : prev));
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!visible) return null;

  return (
    <button
      type="button"
      className="back-to-top"
      onClick={scrollToTop}
      aria-label="Back to Top"
      title="Back to Top"
    >
      <i className="fas fa-arrow-up"></i>
    </button>
  );
});

export default BackToTop;
