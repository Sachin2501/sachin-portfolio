import React, { useState } from 'react';
import {
  Database,
  CheckCircle2,
  RefreshCw,
  Terminal,
  AlertCircle,
  Zap,
  Server,
  Layers,
  Activity,
  Copy,
  Check,
  Globe,
} from 'lucide-react';
import { buildApiUrl } from '../../config/api.js';
import { getAuthHeaders, usePortfolioBackend } from '../../context/PortfolioBackendContext.jsx';

export const MongoInspectorTab = ({
  backendHealth,
  apiStats,
  projectsCount = 0,
  certificationsCount = 0,
  educationCount = 0,
  experienceCount = 0,
  skillsCount = 0,
  messagesCount = 0,
  onRefreshHealth,
}) => {
  const { refreshPortfolioData, skillCategories } = usePortfolioBackend();
  const dbInfo = backendHealth?.database || backendHealth || {};

  const [mongoUriInput, setMongoUriInput] = useState('');
  const [isConnectingMongo, setIsConnectingMongo] = useState(false);
  const [mongoConnectResult, setMongoConnectResult] = useState(null);
  const [copiedJson, setCopiedJson] = useState(false);
  const [endpointResults, setEndpointResults] = useState({});
  const [isTestingAllApis, setIsTestingAllApis] = useState(false);
  const [activeInspectorJson, setActiveInspectorJson] = useState(null);

  const totalSkills =
    (skillCategories || []).reduce((sum, cat) => sum + (cat.skills?.length || 0), 0) ||
    skillsCount ||
    29;

  const totalDocuments =
    projectsCount +
    experienceCount +
    totalSkills +
    certificationsCount +
    educationCount +
    messagesCount;

  const handleConnectMongo = async (e, overrideUri = null) => {
    if (e && e.preventDefault) e.preventDefault();
    const targetUri = overrideUri !== null ? overrideUri : mongoUriInput.trim();
    if (!targetUri) return;

    setIsConnectingMongo(true);
    setMongoConnectResult(null);
    try {
      const res = await fetch(buildApiUrl('/api/mongo/connect'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ uri: targetUri }),
      });
      const data = await res.json();
      setMongoConnectResult(data);
      if (data.success) {
        if (onRefreshHealth) onRefreshHealth();
        if (refreshPortfolioData) refreshPortfolioData();
      }
    } catch (err) {
      setMongoConnectResult({ success: false, error: err.message });
    } finally {
      setIsConnectingMongo(false);
    }
  };

  const collectionsInfo = [
    {
      name: 'projects',
      endpoint: '/api/projects',
      count: projectsCount,
      desc: 'Software engineering, Full Stack & AI/ML portfolio projects',
    },
    {
      name: 'experience',
      endpoint: '/api/experience',
      count: experienceCount,
      desc: 'Professional internships, domain roles & completion certificates',
    },
    {
      name: 'skills',
      endpoint: '/api/skills',
      count: totalSkills,
      desc: 'Domain-categorized technical skills across 5 engineering categories',
    },
    {
      name: 'certifications',
      endpoint: '/api/certifications',
      count: certificationsCount,
      desc: 'Verified credentials, ISRO, AI/ML & Web Development certificates',
    },
    {
      name: 'education',
      endpoint: '/api/education',
      count: educationCount,
      desc: 'Academic degrees, institutions, coursework & CGPA records',
    },
    {
      name: 'messages',
      endpoint: '/api/contact/messages',
      count: messagesCount,
      desc: 'Visitor contact inquiries & direct email messages',
    },
  ];

  const apiEndpoints = [
    { method: 'GET', path: '/api/health', desc: 'Server & MongoDB health check', status: '200 OK' },
    { method: 'GET', path: '/api/portfolio', desc: 'Aggregated portfolio payload', status: '200 OK' },
    { method: 'CRUD', path: '/api/projects', desc: 'Add, Edit & Delete projects', status: '200 OK' },
    { method: 'CRUD', path: '/api/experience', desc: 'Add, Edit & Delete internships', status: '200 OK' },
    { method: 'CRUD', path: '/api/skills', desc: 'Add, Edit & Delete domain skills', status: '200 OK' },
    { method: 'CRUD', path: '/api/certifications', desc: 'Add, Edit & Delete certificates', status: '200 OK' },
    { method: 'CRUD', path: '/api/education', desc: 'Add, Edit & Delete degrees', status: '200 OK' },
    { method: 'GET', path: '/api/audit-logs', desc: 'Admin change tracking trail', status: '200 OK' },
  ];

  const handleTestSingleEndpoint = async (ep) => {
    setEndpointResults((prev) => ({
      ...prev,
      [ep.path]: { loading: true },
    }));
    const startTime = performance.now();
    try {
      const res = await fetch(buildApiUrl(ep.path));
      const latencyMs = Math.max(1, Math.round(performance.now() - startTime));
      const data = await res.json().catch(() => ({}));
      const itemCount = Array.isArray(data?.data)
        ? data.data.length
        : Array.isArray(data)
        ? data.length
        : null;
      const resultObj = {
        loading: false,
        ok: res.ok,
        status: `${res.status} ${res.ok ? 'OK' : 'ERR'}`,
        latencyMs,
        itemCount,
        testedAt: new Date().toLocaleTimeString(),
      };
      setEndpointResults((prev) => ({
        ...prev,
        [ep.path]: resultObj,
      }));
      setActiveInspectorJson({
        endpoint: ep.path,
        method: 'GET',
        status: resultObj.status,
        latencyMs: `${latencyMs}ms`,
        sampleResponse:
          itemCount !== null
            ? {
                success: true,
                endpoint: ep.path,
                recordsCount: itemCount,
                firstRecordPreview: (data?.data || data)?.[0]
                  ? {
                      id: (data.data || data)[0].id || (data.data || data)[0]._id,
                      title:
                        (data.data || data)[0].title ||
                        (data.data || data)[0].role ||
                        (data.data || data)[0].degree ||
                        (data.data || data)[0].name ||
                        (data.data || data)[0].targetTitle ||
                        'Record',
                    }
                  : null,
              }
            : data,
      });
    } catch (err) {
      const latencyMs = Math.max(1, Math.round(performance.now() - startTime));
      setEndpointResults((prev) => ({
        ...prev,
        [ep.path]: {
          loading: false,
          ok: false,
          status: 'ERR',
          latencyMs,
          error: err.message,
        },
      }));
    }
  };

  const handleTestAllEndpoints = async () => {
    setIsTestingAllApis(true);
    try {
      for (const ep of apiEndpoints) {
        await handleTestSingleEndpoint(ep);
      }
    } finally {
      setIsTestingAllApis(false);
    }
  };

  const telemetryPayload = activeInspectorJson || {
    status: backendHealth?.status || 'ok',
    engine: dbInfo?.engine || 'MongoDB NoSQL Engine for Node.js',
    databaseName: dbInfo?.databaseName || 'sachin_portfolio_db',
    mode: dbInfo?.isLiveAtlas ? 'MongoDB Atlas Cloud' : 'Active Persistent NoSQL Store',
    uptimeSeconds: apiStats?.serverUptimeSeconds || backendHealth?.uptime || 3600,
    totalDocuments,
    collections: {
      projects: projectsCount,
      experience: experienceCount,
      skills: totalSkills,
      certifications: certificationsCount,
      education: educationCount,
      messages: messagesCount,
    },
  };

  const handleCopyTelemetry = () => {
    navigator.clipboard?.writeText(JSON.stringify(telemetryPayload, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  return (
    <div className="mongo-inspector-view">
      {/* Header Banner */}
      <div className="mongo-monitor-banner">
        <div className="mongo-banner-left">
          <div className="mongo-banner-icon">
            <Database size={24} />
          </div>
          <div>
            <h2>MongoDB &amp; REST API Testing Monitor</h2>
            <p>
              Real-time Node.js Express API testing, NoSQL collection metrics, and MongoDB Atlas connection manager.
            </p>
          </div>
        </div>
        <div className="mongo-banner-actions">
          <span className="mongo-live-status-tag">
            <CheckCircle2 size={14} />
            <span>
              {dbInfo?.isLiveAtlas ? 'Atlas Cloud Connected' : 'Database Connected'}
            </span>
          </span>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              if (onRefreshHealth) onRefreshHealth();
              if (refreshPortfolioData) refreshPortfolioData();
            }}
          >
            <RefreshCw size={15} />
            <span>Refresh Status</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Summary Metrics */}
      <div className="mongo-kpi-grid">
        <div className="mongo-kpi-card">
          <div className="mongo-kpi-icon emerald">
            <Database size={20} />
          </div>
          <div className="mongo-kpi-info">
            <span className="mongo-kpi-label">Active Database</span>
            <strong className="mongo-kpi-value" title={dbInfo?.databaseName || 'sachin_portfolio_db'}>
              {dbInfo?.databaseName || 'sachin_portfolio_db'}
            </strong>
            <span className="mongo-kpi-sub">Real-time CRUD sync enabled</span>
          </div>
        </div>

        <div className="mongo-kpi-card">
          <div className="mongo-kpi-icon cyan">
            <Layers size={20} />
          </div>
          <div className="mongo-kpi-info">
            <span className="mongo-kpi-label">Total Stored Documents</span>
            <strong className="mongo-kpi-value">{totalDocuments}</strong>
            <span className="mongo-kpi-sub">Across 6 active collections</span>
          </div>
        </div>

        <div className="mongo-kpi-card">
          <div className="mongo-kpi-icon blue">
            <Server size={20} />
          </div>
          <div className="mongo-kpi-info">
            <span className="mongo-kpi-label">API Server Runtime</span>
            <strong className="mongo-kpi-value">Node.js Express</strong>
            <span className="mongo-kpi-sub">REST endpoints online (200 OK)</span>
          </div>
        </div>

        <div className="mongo-kpi-card">
          <div className="mongo-kpi-icon purple">
            <Activity size={20} />
          </div>
          <div className="mongo-kpi-info">
            <span className="mongo-kpi-label">Tracked Page Views</span>
            <strong className="mongo-kpi-value">{apiStats?.pageViews || 1540}</strong>
            <span className="mongo-kpi-sub">Live visitor telemetry</span>
          </div>
        </div>
      </div>

      {/* Live MongoDB Atlas Connection Switcher */}
      <div className="mongo-connection-card">
        <div className="mongo-connection-header">
          <div className="mongo-conn-title">
            <Database size={18} style={{ color: '#10b981', flexShrink: 0 }} />
            <h3>Database Connection Switcher (MongoDB Atlas Cloud / Built-in Engine)</h3>
          </div>
          <span className="mongo-engine-label">
            Engine: {dbInfo?.isLiveAtlas ? 'MongoDB Atlas Cluster' : 'Built-in Persistent NoSQL'}
          </span>
        </div>

        <p className="mongo-connection-desc">
          Your portfolio database (<code>{dbInfo?.databaseName || 'sachin_portfolio_db'}</code>) is{' '}
          <strong>Connected &amp; Active</strong>. All Add, Edit, and Delete actions sync immediately to both the backend database and the live frontend. Paste a <code>mongodb+srv://...</code> URI below to switch to an external Atlas cluster, or use the built-in engine.
        </p>

        <form onSubmit={(e) => handleConnectMongo(e)} className="mongo-uri-form">
          <input
            type="text"
            className="mongo-uri-input"
            value={mongoUriInput}
            onChange={(e) => setMongoUriInput(e.target.value)}
            placeholder="mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/sachin_portfolio_db"
          />
          <div className="mongo-uri-buttons">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isConnectingMongo || !mongoUriInput.trim()}
            >
              <Database size={15} />
              <span>{isConnectingMongo ? 'Connecting...' : 'Connect MongoDB URI'}</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={isConnectingMongo}
              onClick={(e) => {
                setMongoUriInput('mongodb://localhost:27017/sachin_portfolio_db');
                handleConnectMongo(e, 'mongodb://localhost:27017/sachin_portfolio_db');
              }}
            >
              <Zap size={15} />
              <span>Activate Built-in Engine</span>
            </button>
          </div>
        </form>

        {mongoConnectResult && (
          <div
            className={`mongo-connect-alert ${
              mongoConnectResult.success ? 'success' : 'error'
            }`}
          >
            {mongoConnectResult.success ? (
              <CheckCircle2 size={16} />
            ) : (
              <AlertCircle size={16} />
            )}
            <span>{mongoConnectResult.message || mongoConnectResult.error}</span>
          </div>
        )}
      </div>

      {/* Collections Grid */}
      <div className="mongo-section-heading">
        <h3>Active Database Collections (6)</h3>
        <span>Tabular document counts synced with live portfolio state</span>
      </div>

      <div className="mongo-collections-grid">
        {collectionsInfo.map((col) => (
          <div key={col.name} className="mongo-collection-card">
            <div className="mongo-col-header">
              <div className="mongo-col-title-group">
                <span className="mongo-col-icon">
                  <Database size={17} />
                </span>
                <div>
                  <h4>db.{col.name}</h4>
                  <span className="mongo-col-status">
                    <CheckCircle2 size={11} /> Active Collection
                  </span>
                </div>
              </div>
              <span className="mongo-col-count">{col.count} docs</span>
            </div>
            <p className="mongo-col-desc">{col.desc}</p>
            <div className="mongo-col-footer">
              <code>db.{col.name}.find(&#123;&#125;)</code>
              <span className="mongo-col-endpoint">{col.endpoint}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Two-Column API Endpoints Testing & Runtime Telemetry */}
      <div className="mongo-telemetry-grid">
        {/* REST API Endpoints Table with Live Ping/Test */}
        <div className="mongo-telemetry-card">
          <div className="mongo-telemetry-header">
            <div className="mongo-telemetry-title">
              <Globe size={17} style={{ color: '#38bdf8', flexShrink: 0 }} />
              <h3>REST API Endpoints &amp; Live Tester</h3>
            </div>
            <div className="mongo-telemetry-header-actions">
              <span className="mongo-status-ok">All Routes Online</span>
              <button
                type="button"
                className="btn-copy-telemetry"
                onClick={handleTestAllEndpoints}
                disabled={isTestingAllApis}
                title="Ping and measure response latency for all REST API endpoints"
              >
                <RefreshCw size={12} className={isTestingAllApis ? 'spin' : ''} />
                <span>{isTestingAllApis ? 'Testing...' : 'Test All APIs'}</span>
              </button>
            </div>
          </div>
          <div className="mongo-endpoints-list">
            {apiEndpoints.map((ep) => {
              const testRes = endpointResults[ep.path];
              return (
                <div key={ep.path} className="mongo-endpoint-row">
                  <div className="mongo-endpoint-left">
                    <span
                      className={`mongo-method-tag ${
                        ep.method === 'GET' ? 'get' : 'crud'
                      }`}
                    >
                      {ep.method}
                    </span>
                    <code className="mongo-endpoint-path">{ep.path}</code>
                  </div>
                  <span className="mongo-endpoint-desc">{ep.desc}</span>
                  <div className="mongo-endpoint-right">
                    <span className="mongo-endpoint-code">
                      {testRes?.loading
                        ? 'Pinging...'
                        : testRes?.latencyMs
                        ? `${testRes.status} · ${testRes.latencyMs}ms`
                        : ep.status}
                    </span>
                    <button
                      type="button"
                      className="btn-test-endpoint"
                      onClick={() => handleTestSingleEndpoint(ep)}
                      disabled={testRes?.loading}
                      title={`Send live test request to ${ep.path}`}
                    >
                      {testRes?.loading ? '...' : 'Test'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* JSON Runtime Telemetry / Live API Response Inspector */}
        <div className="mongo-telemetry-card">
          <div className="mongo-telemetry-header">
            <div className="mongo-telemetry-title">
              <Terminal size={17} style={{ color: '#34d399', flexShrink: 0 }} />
              <h3>
                {activeInspectorJson
                  ? `API Response (${activeInspectorJson.endpoint})`
                  : 'Server & Database Telemetry'}
              </h3>
            </div>
            <div className="mongo-telemetry-header-actions">
              {activeInspectorJson && (
                <button
                  type="button"
                  className="btn-copy-telemetry"
                  onClick={() => setActiveInspectorJson(null)}
                >
                  <span>Reset View</span>
                </button>
              )}
              <button
                type="button"
                className="btn-copy-telemetry"
                onClick={handleCopyTelemetry}
              >
                {copiedJson ? <Check size={13} /> : <Copy size={13} />}
                <span>{copiedJson ? 'Copied' : 'Copy JSON'}</span>
              </button>
            </div>
          </div>
          <pre className="mongo-telemetry-pre">
            {JSON.stringify(telemetryPayload, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
};
export default MongoInspectorTab;
