import React, { useState, useEffect, useRef } from 'react';
import { Cpu } from 'lucide-react';
import { SectionTechBackground } from './SectionTechBackground.jsx';
import { usePortfolioBackend } from '../context/PortfolioBackendContext.jsx';

export const Skills = () => {
  const { skillCategories: dynamicSkillCategories } = usePortfolioBackend();
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const gridRef = useRef(null);

  const filterTabs = [
    { id: 'all', label: 'All Domains', icon: 'fas fa-layer-group' },
    { id: 'frontend', label: 'Frontend', icon: 'fas fa-palette' },
    { id: 'backend', label: 'Backend & Cloud', icon: 'fas fa-server' },
    { id: 'ai-ml', label: 'AI & Machine Learning', icon: 'fas fa-brain' },
    { id: 'programming-languages', label: 'Languages & Core', icon: 'fas fa-code' },
    { id: 'tools-devops', label: 'DevOps & Tools', icon: 'fas fa-toolbox' },
  ];

  const totalSkillCount = dynamicSkillCategories.reduce(
    (sum, cat) => sum + cat.skills.length,
    0
  );

  const filteredCategories = dynamicSkillCategories
    .filter((cat) => {
      if (activeCategory === 'all') return true;
      return cat.id === activeCategory;
    })
    .map((cat) => {
      if (!searchQuery.trim()) return cat;
      const filteredSkills = cat.skills.filter((s) =>
        (typeof s === 'string' ? s : s.name)
          .toLowerCase()
          .includes(searchQuery.toLowerCase())
      );
      return {
        ...cat,
        skills: filteredSkills,
      };
    })
    .filter((cat) => cat.skills.length > 0);

  // Intersection Observer for sequential slide-up entrance animation of skill cards
  useEffect(() => {
    if (!gridRef.current) return;

    const cards = gridRef.current.querySelectorAll('.skills-domain-card');
    if (!cards || cards.length === 0) return;

    if (typeof IntersectionObserver === 'undefined') {
      cards.forEach((card) => card.classList.add('slide-up-revealed'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('slide-up-revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        root: null,
        rootMargin: '0px 0px -40px 0px',
        threshold: 0.12,
      }
    );

    cards.forEach((card) => observer.observe(card));

    return () => observer.disconnect();
  }, [filteredCategories]);

  return (
    <section id="skills" className="skills-section">
      <SectionTechBackground type="skills" />
      <div className="container">
        <div className="section-header-center">
          <h2 className="section-title">
            <span className="section-title-icon-badge" aria-hidden="true">
              <Cpu className="section-title-icon" size={24} strokeWidth={2.2} />
            </span>
            <span className="section-title-text">Skills & Technologies</span>
          </h2>
          <p className="skills-lead-subtitle">
            Domain-wise technical capabilities across software engineering, artificial intelligence, and core computer science
          </p>
        </div>

        {/* Compact Domain Filter Rail & Search */}
        <div className="skills-toolbar-card">
          <div className="skills-filter-rail" role="tablist" aria-label="Skills Category Filter">
            {filterTabs.map((tab) => {
              const isActive = activeCategory === tab.id;
              let count = 0;
              if (tab.id === 'all') {
                count = totalSkillCount;
              } else {
                const found = dynamicSkillCategories.find((c) => c.id === tab.id);
                count = found ? found.skills.length : 0;
              }

              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`skills-tab-pill ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveCategory(tab.id)}
                >
                  <i className={tab.icon}></i>
                  <span>{tab.label}</span>
                  <span className="skills-tab-count">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="skills-search-wrapper">
            <i className="fas fa-magnifying-glass search-icon"></i>
            <input
              type="text"
              placeholder="Search skill (e.g. Java, React)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="skills-search-input"
              aria-label="Filter skills by keyword"
            />
            {searchQuery && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Short & Compact Domain-Wise Grid with Sequential Reveal */}
        {filteredCategories.length === 0 ? (
          <div className="skills-empty-state">
            <i className="fas fa-code-slash"></i>
            <p>No technologies found matching "<strong>{searchQuery}</strong>"</p>
            <button
              type="button"
              className="btn skills-reset-btn"
              onClick={() => {
                setActiveCategory('all');
                setSearchQuery('');
              }}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="skills-domain-grid" ref={gridRef}>
            {filteredCategories.map((cat, cardIndex) => (
              <div
                key={cat.id}
                className="skills-domain-card slide-up-revealed"
                style={{
                  '--card-index': cardIndex,
                  transitionDelay: `${cardIndex * 85}ms`,
                }}
              >
                {/* Domain Header */}
                <div className="skills-domain-header">
                  <div className="domain-icon-circle">
                    <i className={cat.icon}></i>
                  </div>
                  <div className="domain-title-wrap">
                    <div className="domain-title-row">
                      <h3 className="domain-title">{cat.title}</h3>
                      <span className="domain-count-badge">
                        {cat.skills.length}
                      </span>
                    </div>
                    {cat.subtitle && (
                      <p className="domain-subtitle">{cat.subtitle}</p>
                    )}
                  </div>
                </div>

                {/* Compact Skill Badges/Tags */}
                <div className="domain-skills-wrap">
                  {cat.skills.map((skillItem, chipIndex) => {
                    const skillId = typeof skillItem === 'object' ? (skillItem.id || skillItem._id || skillItem.name) : skillItem;
                    const skillName = typeof skillItem === 'string' ? skillItem : skillItem.name;
                    const iconClass = typeof skillItem === 'object' && skillItem.icon ? skillItem.icon : 'fas fa-check';
                    const isHighlight = typeof skillItem === 'object' && Boolean(skillItem.highlight || skillItem.featured);
                    const level = typeof skillItem === 'object' && skillItem.level ? skillItem.level : 'Proficient';

                    return (
                      <div
                        key={`${skillId}-${skillName}-${level}-${isHighlight ? '1' : '0'}-${iconClass}`}
                        className={`compact-skill-chip ${isHighlight ? 'featured-chip' : ''}`}
                        title={`${skillName} • ${level}`}
                        style={{
                          '--chip-index': chipIndex,
                        }}
                      >
                        <i className={`${iconClass} chip-icon`}></i>
                        <span className="chip-name">{skillName}</span>
                        {isHighlight && (
                          <span className="chip-star" title="Core Skill">★</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default Skills;
