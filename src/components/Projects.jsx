import React, { useState } from 'react';
import { FolderGit2 } from 'lucide-react';
import { SectionTechBackground } from './SectionTechBackground.jsx';
import { usePortfolioBackend } from '../context/PortfolioBackendContext.jsx';

export const Projects = () => {
  const { projectsList } = usePortfolioBackend();
  const [selectedTag, setSelectedTag] = useState('All');

  const filterTags = [
    { key: 'All', label: 'All', icon: 'fas fa-layer-group' },
    { key: 'React', label: 'React', icon: 'fab fa-react' },
    { key: 'Machine Learning', label: 'Machine Learning', icon: 'fas fa-brain' },
    { key: 'Backend', label: 'Backend', icon: 'fas fa-server' },
  ];

  const filterProjects = (tag) => {
    if (tag === 'All') return projectsList;
    return projectsList.filter((proj) => {
      if (!proj.tech) return false;
      const lowerTag = tag.toLowerCase();
      if (lowerTag === 'react') {
        return proj.tech.some((t) => t.toLowerCase().includes('react'));
      }
      if (lowerTag === 'machine learning') {
        return proj.tech.some(
          (t) =>
            t.toLowerCase().includes('machine learning') ||
            t.toLowerCase().includes('ai') ||
            t.toLowerCase().includes('deep learning') ||
            t.toLowerCase().includes('opencv') ||
            t.toLowerCase().includes('python')
        );
      }
      if (lowerTag === 'backend') {
        return proj.tech.some(
          (t) =>
            t.toLowerCase().includes('node') ||
            t.toLowerCase().includes('backend') ||
            t.toLowerCase().includes('sql') ||
            t.toLowerCase().includes('mongo') ||
            t.toLowerCase().includes('express') ||
            t.toLowerCase().includes('database')
        );
      }
      return proj.tech.some((t) => t.toLowerCase() === lowerTag);
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
            <p>No projects match the tag "#{selectedTag}".</p>
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
            {displayedProjects.map((proj) => (
              <div key={proj.id} className="project-card">
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
                    {proj.tech.map((tag) => {
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
                      href={proj.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="project-link-btn"
                    >
                      <i className="fab fa-github"></i> Code
                    </a>
                    {proj.liveUrl && (
                      <a
                        href={proj.liveUrl}
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
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
