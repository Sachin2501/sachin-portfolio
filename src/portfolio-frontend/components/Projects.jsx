import React, { useState } from 'react';
import { FolderGit2 } from 'lucide-react';
import { SectionTechBackground } from './SectionTechBackground.jsx';
import { usePortfolioBackend } from '../../context/PortfolioBackendContext.jsx';

export const Projects = () => {
  const { projectsList } = usePortfolioBackend();
  const [selectedTag, setSelectedTag] = useState('All');

  const filterTags = [
    { key: 'All', label: 'All', icon: 'fas fa-layer-group' },
    { key: 'React', label: 'React', icon: 'fab fa-react' },
    { key: 'Machine Learning', label: 'Machine Learning', icon: 'fas fa-brain' },
    { key: 'Backend', label: 'Backend', icon: 'fas fa-server' },
  ];

  const getProjectTech = (proj) => {
    if (Array.isArray(proj.tech) && proj.tech.length > 0) return proj.tech;
    if (Array.isArray(proj.technologies) && proj.technologies.length > 0) return proj.technologies;
    return [];
  };

  const filterProjects = (tag) => {
    if (tag === 'All') return projectsList;
    return projectsList.filter((proj) => {
      const techList = getProjectTech(proj);
      const tagsList = Array.isArray(proj.tags) ? proj.tags : [];
      const allTags = [...techList, ...tagsList];
      const catStr = String(proj.category || '').toLowerCase();
      const lowerTag = tag.toLowerCase();

      if (lowerTag === 'react') {
        return (
          allTags.some((t) => String(t).toLowerCase().includes('react')) ||
          catStr.includes('frontend') ||
          catStr.includes('react')
        );
      }
      if (lowerTag === 'machine learning') {
        return (
          allTags.some(
            (t) =>
              String(t).toLowerCase().includes('machine learning') ||
              String(t).toLowerCase().includes('ai') ||
              String(t).toLowerCase().includes('deep learning') ||
              String(t).toLowerCase().includes('opencv') ||
              String(t).toLowerCase().includes('tensorflow') ||
              String(t).toLowerCase().includes('python')
          ) ||
          catStr.includes('ai') ||
          catStr.includes('machine learning')
        );
      }
      if (lowerTag === 'backend') {
        return (
          allTags.some(
            (t) =>
              String(t).toLowerCase().includes('node') ||
              String(t).toLowerCase().includes('backend') ||
              String(t).toLowerCase().includes('sql') ||
              String(t).toLowerCase().includes('mongo') ||
              String(t).toLowerCase().includes('express') ||
              String(t).toLowerCase().includes('database') ||
              String(t).toLowerCase().includes('mern')
          ) ||
          catStr.includes('backend') ||
          catStr.includes('full stack') ||
          catStr.includes('mern')
        );
      }
      return allTags.some((t) => String(t).toLowerCase() === lowerTag);
    });
  };

  const displayedProjects = filterProjects(selectedTag);

  return (
    <section id="projects">
      <SectionTechBackground type="projects" />
      <div className="container">
        <div className="section-header-center">
          <h2 className="section-title">
            <span className="section-title-icon-badge" aria-hidden="true">
              <FolderGit2 className="section-title-icon" size={24} strokeWidth={2.2} />
            </span>
            <span className="section-title-text">Featured Projects</span>
          </h2>
        </div>

        {/* Tag Filter Bar */}
        <div className="project-filter-wrapper">
          <div
            className="project-filter-bar"
            role="tablist"
            aria-label="Filter projects by technology tag"
          >
            {filterTags.map((tag) => {
              const count = filterProjects(tag.key).length;
              const isActive = selectedTag === tag.key;

              return (
                <button
                  key={tag.key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`project-filter-pill ${isActive ? 'active' : ''}`}
                  onClick={() => setSelectedTag(tag.key)}
                >
                  <i className={tag.icon} style={{ marginRight: '6px' }}></i>
                  <span>{tag.label}</span>
                  <span className="project-filter-count">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="project-filter-status">
            <span>
              Showing <strong>{displayedProjects.length}</strong>{' '}
              {displayedProjects.length === 1 ? 'project' : 'projects'}
              {selectedTag !== 'All' && (
                <>
                  {' '}for tag <span className="highlight-tag">#{selectedTag}</span>
                  <button
                    type="button"
                    className="clear-filter-btn"
                    onClick={() => setSelectedTag('All')}
                    title="Clear filter"
                  >
                    ✕ Clear
                  </button>
                </>
              )}
            </span>
          </div>
        </div>

        {displayedProjects.length === 0 ? (
          <div className="project-empty-state">
            <i
              className="fas fa-folder-open"
              style={{ fontSize: '3rem', color: '#94a3b8', marginBottom: '1rem' }}
            ></i>
            <h3>No projects found</h3>
            <p>No projects match the tag &ldquo;#{selectedTag}&rdquo;.</p>
            <button
              type="button"
              className="btn"
              onClick={() => setSelectedTag('All')}
              style={{ marginTop: '1rem' }}
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <div className="projects-container">
            {displayedProjects.map((proj) => {
              const techList = getProjectTech(proj);
              const githubHref = proj.githubUrl || proj.github || '#';
              const liveHref = proj.liveUrl || proj.live || proj.demoUrl || '';

              return (
                <div key={proj.id || proj._id} className="project-card">
                  <div className="project-image">
                    <img src={proj.image} alt={proj.title} loading="lazy" />
                    {proj.category && (
                      <span className="project-category-badge">{proj.category}</span>
                    )}
                  </div>

                  <div className="project-content">
                    <h3>{proj.title}</h3>
                    <p>{proj.description}</p>

                    <div className="project-tech">
                      {techList.map((tag) => {
                        const isMatchingFilter =
                          selectedTag !== 'All' &&
                          (tag.toLowerCase() === selectedTag.toLowerCase() ||
                            (selectedTag === 'Machine Learning' &&
                              (tag === 'Machine Learning' ||
                                tag === 'Deep Learning' ||
                                tag === 'AI/ML')));

                        return (
                          <div
                            key={tag}
                            className={`tech-tag ${isMatchingFilter ? 'active-filter-tag' : ''}`}
                            onClick={() => {
                              if (
                                filterTags.some(
                                  (f) => f.key.toLowerCase() === tag.toLowerCase()
                                )
                              ) {
                                setSelectedTag(tag);
                              }
                            }}
                            style={{
                              cursor: filterTags.some(
                                (f) => f.key.toLowerCase() === tag.toLowerCase()
                              )
                                ? 'pointer'
                                : 'default',
                            }}
                          >
                            {tag}
                          </div>
                        );
                      })}
                    </div>

                    <div className="project-links">
                      <a
                        href={githubHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="project-link-btn"
                      >
                        <i className="fab fa-github"></i> Code
                      </a>
                      {liveHref && liveHref !== '#' && (
                        <a
                          href={liveHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="project-link-btn demo-btn"
                        >
                          <i className="fas fa-external-link-alt"></i> Live Demo
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
