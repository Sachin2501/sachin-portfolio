import React, { useState, useMemo } from 'react';
import {
  History,
  FolderGit2,
  Briefcase,
  Award,
  GraduationCap,
  Cpu,
  Image as ImageIcon,
  PlusCircle,
  Edit,
  Trash2,
  Clock,
  User,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Download,
  FileCode,
} from 'lucide-react';

export const AdminAuditLogs = ({
  auditLogs = [],
  auditStats = {},
  isLoading = false,
  onRefresh,
  onDeleteLog,
  onClearLogs,
}) => {
  const [collectionFilter, setCollectionFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all'); // 'all' | 'CREATE' | 'UPDATE' | 'DELETE'
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedLogId, setExpandedLogId] = useState(null);

  const COLLECTION_META = {
    projects: { label: 'Project', icon: FolderGit2, colorClass: 'projects' },
    experience: { label: 'Experience', icon: Briefcase, colorClass: 'experience' },
    certifications: { label: 'Certification', icon: Award, colorClass: 'projects' },
    education: { label: 'Education', icon: GraduationCap, colorClass: 'experience' },
    skills: { label: 'Skill', icon: Cpu, colorClass: 'projects' },
    profile: { label: 'Profile', icon: ImageIcon, colorClass: 'experience' },
  };

  // Filter logs based on collection, action, and search term
  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      if (collectionFilter !== 'all' && log.collectionName !== collectionFilter) {
        return false;
      }

      if (actionFilter !== 'all' && log.action !== actionFilter) {
        return false;
      }

      if (searchTerm.trim()) {
        const query = searchTerm.trim().toLowerCase();
        const titleMatch = log.targetTitle && log.targetTitle.toLowerCase().includes(query);
        const idMatch = log.targetId && String(log.targetId).toLowerCase().includes(query);
        const colMatch =
          log.collectionName && String(log.collectionName).toLowerCase().includes(query);
        const userMatch =
          log.changedBy?.username && log.changedBy.username.toLowerCase().includes(query);
        const emailMatch =
          log.changedBy?.email && log.changedBy.email.toLowerCase().includes(query);
        const actionMatch = log.action && log.action.toLowerCase().includes(query);
        return titleMatch || idMatch || colMatch || userMatch || emailMatch || actionMatch;
      }

      return true;
    });
  }, [auditLogs, collectionFilter, actionFilter, searchTerm]);

  const toggleExpand = (logId) => {
    setExpandedLogId((prev) => (prev === logId ? null : logId));
  };

  // Format date helper
  const formatDate = (isoString) => {
    if (!isoString) return 'Just now';
    try {
      const d = new Date(isoString);
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
    } catch {
      return isoString;
    }
  };

  // Calculate relative time
  const getRelativeTime = (isoString) => {
    if (!isoString) return '';
    try {
      const diffSecs = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
      if (diffSecs < 10) return 'Just now';
      if (diffSecs < 60) return `${diffSecs}s ago`;
      const mins = Math.floor(diffSecs / 60);
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    } catch {
      return '';
    }
  };

  // Export audit logs as downloadable JSON file
  const handleExportJson = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(filteredLogs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `portfolio_audit_logs_${new Date().toISOString().slice(0, 10)}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const countByCol = (col) =>
    auditStats?.byCollection?.[col] ??
    auditLogs.filter((l) => l.collectionName === col).length;

  return (
    <div className="admin-audit-logs-view">
      {/* 1. Header & Title Banner */}
      <div className="audit-header-banner">
        <div className="audit-title-group">
          <div className="audit-icon-badge">
            <History size={24} className="text-cyan-400" />
          </div>
          <div>
            <h2>Audit Trail &amp; Activity History</h2>
            <p>
              Real-time MongoDB audit trail tracking every <strong>Add</strong>, <strong>Edit</strong>, and <strong>Delete</strong> across Projects, Experience, Certifications, Education, Skills, and Profile.
            </p>
          </div>
        </div>

        <div className="audit-header-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onRefresh}
            disabled={isLoading}
            title="Refresh latest audit records"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleExportJson}
            title="Export filtered audit logs as JSON"
            disabled={filteredLogs.length === 0}
          >
            <Download size={14} />
            <span>Export JSON</span>
          </button>

          {onClearLogs && auditLogs.length > 0 && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onClearLogs(collectionFilter)}
              title="Clear audit logs"
              style={{ borderColor: 'rgba(248, 113, 113, 0.35)', color: '#fca5a5' }}
            >
              <Trash2 size={14} />
              <span>{collectionFilter === 'all' ? 'Clear All' : `Clear ${collectionFilter}`}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Quick Metrics Cards */}
      <div className="audit-metrics-grid">
        <div className="audit-metric-card">
          <div className="metric-icon-wrap cyan">
            <History size={20} />
          </div>
          <div className="metric-text-wrap">
            <span className="metric-label">Total Logged Changes</span>
            <span className="metric-number">{auditStats?.total || auditLogs.length}</span>
            <span className="metric-sub">All portfolio collections</span>
          </div>
        </div>

        <div className="audit-metric-card">
          <div className="metric-icon-wrap blue">
            <FolderGit2 size={20} />
          </div>
          <div className="metric-text-wrap">
            <span className="metric-label">Projects &amp; Experience</span>
            <span className="metric-number">
              {countByCol('projects') + countByCol('experience')}
            </span>
            <span className="metric-sub">
              {countByCol('projects')} Projects · {countByCol('experience')} Experience
            </span>
          </div>
        </div>

        <div className="audit-metric-card">
          <div className="metric-icon-wrap emerald">
            <Award size={20} />
          </div>
          <div className="metric-text-wrap">
            <span className="metric-label">Certs, Edu &amp; Skills</span>
            <span className="metric-number">
              {countByCol('certifications') + countByCol('education') + countByCol('skills')}
            </span>
            <span className="metric-sub">
              {countByCol('certifications')} Certs · {countByCol('skills')} Skills · {countByCol('education')} Edu
            </span>
          </div>
        </div>

        <div className="audit-metric-card">
          <div className="metric-icon-wrap purple">
            <Clock size={20} />
          </div>
          <div className="metric-text-wrap">
            <span className="metric-label">Last Activity</span>
            <span className="metric-number text-sm">
              {auditStats?.lastActivity || auditLogs[0]?.timestamp
                ? getRelativeTime(auditStats?.lastActivity || auditLogs[0]?.timestamp)
                : 'None'}
            </span>
            <span className="metric-sub">
              {auditStats?.lastActivity || auditLogs[0]?.timestamp
                ? formatDate(auditStats?.lastActivity || auditLogs[0]?.timestamp).split(',')[0]
                : 'No operations'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Filter Controls & Search Bar */}
      <div className="audit-filter-bar">
        {/* Collection Selector */}
        <div className="filter-pill-group" role="group" aria-label="Filter by Collection">
          <button
            type="button"
            className={`filter-pill-btn ${collectionFilter === 'all' ? 'active' : ''}`}
            onClick={() => setCollectionFilter('all')}
          >
            <span>All ({auditLogs.length})</span>
          </button>
          <button
            type="button"
            className={`filter-pill-btn ${collectionFilter === 'projects' ? 'active' : ''}`}
            onClick={() => setCollectionFilter('projects')}
          >
            <FolderGit2 size={13} />
            <span>Projects ({countByCol('projects')})</span>
          </button>
          <button
            type="button"
            className={`filter-pill-btn ${collectionFilter === 'experience' ? 'active' : ''}`}
            onClick={() => setCollectionFilter('experience')}
          >
            <Briefcase size={13} />
            <span>Experience ({countByCol('experience')})</span>
          </button>
          <button
            type="button"
            className={`filter-pill-btn ${collectionFilter === 'certifications' ? 'active' : ''}`}
            onClick={() => setCollectionFilter('certifications')}
          >
            <Award size={13} />
            <span>Certs ({countByCol('certifications')})</span>
          </button>
          <button
            type="button"
            className={`filter-pill-btn ${collectionFilter === 'education' ? 'active' : ''}`}
            onClick={() => setCollectionFilter('education')}
          >
            <GraduationCap size={13} />
            <span>Education ({countByCol('education')})</span>
          </button>
          <button
            type="button"
            className={`filter-pill-btn ${collectionFilter === 'skills' ? 'active' : ''}`}
            onClick={() => setCollectionFilter('skills')}
          >
            <Cpu size={13} />
            <span>Skills ({countByCol('skills')})</span>
          </button>
        </div>

        {/* Action Selector */}
        <div className="filter-pill-group" role="group" aria-label="Filter by Action">
          <button
            type="button"
            className={`filter-pill-btn ${actionFilter === 'all' ? 'active' : ''}`}
            onClick={() => setActionFilter('all')}
          >
            <span>All Actions</span>
          </button>
          <button
            type="button"
            className={`filter-pill-btn ${actionFilter === 'CREATE' ? 'active' : ''}`}
            onClick={() => setActionFilter('CREATE')}
          >
            <PlusCircle size={13} className="text-emerald-400" />
            <span>Added</span>
          </button>
          <button
            type="button"
            className={`filter-pill-btn ${actionFilter === 'UPDATE' ? 'active' : ''}`}
            onClick={() => setActionFilter('UPDATE')}
          >
            <Edit size={13} className="text-sky-400" />
            <span>Edited</span>
          </button>
          <button
            type="button"
            className={`filter-pill-btn ${actionFilter === 'DELETE' ? 'active' : ''}`}
            onClick={() => setActionFilter('DELETE')}
          >
            <Trash2 size={13} className="text-rose-400" />
            <span>Deleted</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="audit-search-box">
          <Search size={15} className="search-icon" />
          <input
            type="text"
            className="audit-search-input"
            placeholder="Search by title, collection, ID, or admin user..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              type="button"
              className="btn-clear-search"
              onClick={() => setSearchTerm('')}
              title="Clear search"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* 4. Audit Log Entries Feed */}
      <div className="audit-logs-feed">
        {filteredLogs.length === 0 ? (
          <div className="audit-empty-state">
            <History size={40} className="text-slate-500 mb-2" />
            <h3>No Audit Logs Found</h3>
            <p>
              {auditLogs.length === 0
                ? 'No modifications have been recorded yet. Any Add, Edit, or Delete action across portfolio sections will appear here automatically.'
                : 'No audit records match your selected filters or search keyword.'}
            </p>
            {(collectionFilter !== 'all' || actionFilter !== 'all' || searchTerm) && (
              <button
                type="button"
                className="btn btn-secondary btn-sm mt-3"
                onClick={() => {
                  setCollectionFilter('all');
                  setActionFilter('all');
                  setSearchTerm('');
                }}
              >
                Reset All Filters
              </button>
            )}
          </div>
        ) : (
          <div className="audit-logs-list">
            {filteredLogs.map((log) => {
              const logId = log.id || log._id;
              const isExpanded = expandedLogId === logId;
              const isCreate = log.action === 'CREATE';
              const isUpdate = log.action === 'UPDATE';
              const isDelete = log.action === 'DELETE';
              const colMeta = COLLECTION_META[log.collectionName] || {
                label: log.collectionName || 'Item',
                icon: FolderGit2,
                colorClass: 'projects',
              };
              const ColIcon = colMeta.icon;

              return (
                <div
                  key={logId}
                  className={`audit-log-card ${(log.action || 'update').toLowerCase()} ${
                    isExpanded ? 'expanded' : ''
                  }`}
                >
                  {/* Card Main Row */}
                  <div
                    className="audit-card-main-row"
                    onClick={() => toggleExpand(logId)}
                    role="button"
                    tabIndex={0}
                  >
                    {/* Action & Collection Badges */}
                    <div className="audit-action-col">
                      <span className={`audit-badge-action ${(log.action || 'update').toLowerCase()}`}>
                        {isCreate && <PlusCircle size={13} />}
                        {isUpdate && <Edit size={13} />}
                        {isDelete && <Trash2 size={13} />}
                        <span>{isCreate ? 'ADDED' : isUpdate ? 'EDITED' : 'DELETED'}</span>
                      </span>

                      <span className={`audit-badge-col ${colMeta.colorClass}`}>
                        <ColIcon size={12} />
                        <span>{colMeta.label}</span>
                      </span>
                    </div>

                    {/* Target Title & Details */}
                    <div className="audit-target-col">
                      <h4 className="audit-target-title" title={log.targetTitle}>
                        {log.targetTitle}
                      </h4>
                      <div className="audit-target-meta">
                        <span className="audit-item-id">ID: {log.targetId}</span>
                        {log.diff?.modifiedFields && log.diff.modifiedFields.length > 0 && (
                          <span className="audit-modified-pill">
                            Changed: {log.diff.modifiedFields.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Admin User Info */}
                    <div className="audit-user-col">
                      <div className="audit-user-pill">
                        <User size={13} className="text-cyan-400" />
                        <span className="audit-username">@{log.changedBy?.username || 'admin'}</span>
                      </div>
                      <span className="audit-user-email" title={log.changedBy?.email}>
                        {log.changedBy?.email || 'sachinkumar.gheura@gmail.com'}
                      </span>
                    </div>

                    {/* Timestamp */}
                    <div className="audit-time-col">
                      <span className="audit-relative-time">
                        <Clock size={12} />
                        {getRelativeTime(log.timestamp)}
                      </span>
                      <span className="audit-full-time">{formatDate(log.timestamp)}</span>
                    </div>

                    {/* Toggle Expand & Delete Entry */}
                    <div className="audit-expand-col" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {onDeleteLog && (
                        <button
                          type="button"
                          className="btn-delete-card"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteLog(logId);
                          }}
                          title="Delete this audit log entry"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn-toggle-expand"
                        aria-label={isExpanded ? 'Collapse Diff' : 'Expand Diff'}
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Diff / Inspector Panel */}
                  {isExpanded && (
                    <div className="audit-card-diff-panel">
                      <div className="diff-header-bar">
                        <span className="diff-panel-title">
                          <FileCode size={14} className="text-cyan-400" />
                          Detailed Audit Payload &amp; State Snapshot
                        </span>
                        <div className="diff-meta-tags">
                          <span className="meta-tag">Method: {log.metadata?.method || 'REST'}</span>
                          <span className="meta-tag">IP: {log.metadata?.ipAddress || '127.0.0.1'}</span>
                        </div>
                      </div>

                      {/* Before / After Comparison */}
                      {isUpdate && log.diff && (
                        <div className="diff-comparison-grid">
                          <div className="diff-comparison-box before">
                            <span className="diff-box-label text-rose-400">Previous State (Before)</span>
                            <pre className="diff-json-code">
                              {JSON.stringify(log.diff.before || {}, null, 2)}
                            </pre>
                          </div>
                          <div className="diff-comparison-box after">
                            <span className="diff-box-label text-emerald-400">Updated State (After)</span>
                            <pre className="diff-json-code">
                              {JSON.stringify(log.diff.after || {}, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}

                      {isCreate && log.diff?.after && (
                        <div className="diff-snapshot-box">
                          <span className="diff-box-label text-emerald-400">
                            Created Record Snapshot
                          </span>
                          <pre className="diff-json-code">
                            {JSON.stringify(log.diff.after, null, 2)}
                          </pre>
                        </div>
                      )}

                      {isDelete && log.diff?.before && (
                        <div className="diff-snapshot-box">
                          <span className="diff-box-label text-rose-400">
                            Snapshot of Record Prior to Deletion
                          </span>
                          <pre className="diff-json-code">
                            {JSON.stringify(log.diff.before, null, 2)}
                          </pre>
                        </div>
                      )}

                      {/* Technical Request Details */}
                      <div className="diff-footer-details">
                        <span><strong>Collection:</strong> {log.collectionName}</span>
                        <span><strong>Target ID:</strong> {log.targetId}</span>
                        <span><strong>Timestamp:</strong> {log.timestamp}</span>
                        <span><strong>Endpoint:</strong> {log.metadata?.endpoint || `/api/${log.collectionName}`}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAuditLogs;
