import React, { useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  FolderGit2,
  Award,
  GraduationCap,
  Briefcase,
  Cpu,
  Image,
  Inbox,
  Database,
  Sparkles,
  Globe,
  History,
} from 'lucide-react';

export const AdminSidebar = ({
  activeTab,
  setActiveTab,
  counts,
  handleSeedAll,
  isSubmitting,
}) => {
  const navRef = useRef(null);

  const navTabs = [
    { id: 'dashboard', label: 'Dashboard & Metrics', shortLabel: 'Dashboard', icon: LayoutDashboard },
    { id: 'projects', label: `Projects (${counts.projects})`, shortLabel: `Projects (${counts.projects})`, icon: FolderGit2 },
    { id: 'experience', label: `Experience (${counts.experience})`, shortLabel: `Exp (${counts.experience})`, icon: Briefcase },
    { id: 'audit-logs', label: `Audit Trail (${counts.auditLogs || 0})`, shortLabel: `Audit (${counts.auditLogs || 0})`, icon: History },
    { id: 'seo-generator', label: 'SEO & Social Meta', shortLabel: 'SEO', icon: Globe },
    { id: 'certifications', label: `Certifications (${counts.certifications})`, shortLabel: `Certs (${counts.certifications})`, icon: Award },
    { id: 'education', label: `Education (${counts.education})`, shortLabel: `Edu (${counts.education})`, icon: GraduationCap },
    { id: 'skills', label: `Skills (${counts.skills} added)`, shortLabel: `Skills (${counts.skills})`, icon: Cpu },
    { id: 'photos', label: 'Photos & Profile', shortLabel: 'Photos', icon: Image },
    { id: 'messages', label: `Inquiries (${counts.messages})`, shortLabel: `Inbox (${counts.messages})`, icon: Inbox },
    { id: 'mongodb', label: 'MongoDB & API Monitor', shortLabel: 'MongoDB', icon: Database },
  ];

  // Auto-scroll active tab into view horizontally on mobile / tablet
  useEffect(() => {
    if (navRef.current) {
      const activeBtn = navRef.current.querySelector('.portal-nav-item.active');
      if (activeBtn) {
        activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [activeTab]);

  return (
    <aside className="admin-portal-sidebar">
      <nav ref={navRef} className="portal-sidebar-nav" aria-label="Admin Navigation Tabs">
        {navTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={`portal-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={18} className="nav-tab-icon" />
              <span className="nav-tab-text-full">{tab.label}</span>
              <span className="nav-tab-text-compact">{tab.shortLabel}</span>
            </button>
          );
        })}
      </nav>

      <div className="portal-sidebar-footer">
        <div className="sync-button-box">
          <button
            type="button"
            className="btn-sidebar-sync"
            onClick={handleSeedAll}
            disabled={isSubmitting}
            title="Seed default portfolio records to Database"
          >
            <Sparkles size={15} />
            <span>Seed Database Defaults</span>
          </button>
        </div>
        <div className="portal-sidebar-note">
          <span>Backend Engine:</span>
          <code>Node.js + Express + MongoDB</code>
        </div>
      </div>
    </aside>
  );
};
