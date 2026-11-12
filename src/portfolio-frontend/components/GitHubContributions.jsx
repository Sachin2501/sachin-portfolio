import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Activity } from 'lucide-react';
import { SectionTechBackground } from './SectionTechBackground.jsx';
import { buildApiUrl } from '../../config/api.js';

// Offline-only fallback activities covering Pushes, Created, and Other (used only if both Backend Proxy and GitHub API are unreachable)
const fallbackActivities = [
  {
    id: 'act-push-1',
    type: 'PushEvent',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    repo: { name: 'Sachin2501/sachin-portfolio' },
    normalizedBranch: 'main',
    payload: {
      ref: 'refs/heads/main',
      commits: [
        { message: 'chore: remove outdated deployment guides to streamline documentation' },
        { message: 'Update portfolio image to enhance visual presentation' },
      ],
    },
  },
  {
    id: 'act-push-2',
    type: 'PushEvent',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    repo: { name: 'Sachin2501/portfolio_website.io' },
    normalizedBranch: 'new-portfolio',
    payload: {
      ref: 'refs/heads/new-portfolio',
      commits: [
        { message: 'Organize section-wise skills and enhance mobile responsive layouts' },
      ],
    },
  },
  {
    id: 'act-create-1',
    type: 'CreateEvent',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString(),
    repo: { name: 'Sachin2501/sachin-portfolio' },
    normalizedBranch: 'main',
    payload: {
      ref_type: 'repository',
      ref: 'main',
      description: 'Full-stack personal portfolio and Admin CMS built with React, Node.js, and MongoDB.',
      language: 'JavaScript',
    },
  },
  {
    id: 'act-push-3',
    type: 'PushEvent',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 8).toISOString(),
    repo: { name: 'Sachin2501/Sachin2501' },
    normalizedBranch: 'main',
    payload: {
      ref: 'refs/heads/main',
      commits: [
        { message: 'Update developer profile README and tech stack badges' },
      ],
    },
  },
  {
    id: 'act-create-2',
    type: 'CreateEvent',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 13).toISOString(),
    repo: { name: 'Sachin2501/FloodLearn-Tracker' },
    normalizedBranch: 'main',
    payload: {
      ref_type: 'branch',
      ref: 'refs/heads/main',
      description: 'Interactive tracker and informational system for flood tracking and mitigation.',
      language: 'TypeScript',
    },
  },
  {
    id: 'act-other-1',
    type: 'WatchEvent',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 13).toISOString(),
    repo: { name: 'suryakantarora/portfolio-3d' },
    payload: {
      action: 'started',
      description: 'Interactive 3D developer portfolio website.',
      language: 'JavaScript',
    },
  },
  {
    id: 'act-other-2',
    type: 'WatchEvent',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString(),
    repo: { name: 'Sachin2501/AIDriven-Archaeological-Site-Mapping' },
    payload: {
      action: 'started',
      description: 'AI platform for classifying vegetation land and soil types for archaeological research.',
      language: 'JavaScript',
    },
  },
  {
    id: 'act-other-3',
    type: 'WatchEvent',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 20).toISOString(),
    repo: { name: 'Sachin2501/Sign_Language_Detection_DeepLearning_Project' },
    payload: {
      action: 'started',
      description: 'Deep learning-based project for detecting and classifying hand gestures in sign language.',
      language: 'Python',
    },
  },
];

export const GitHubContributions = () => {
  const username = 'Sachin2501';

  const [profile, setProfile] = useState(null);
  const [events, setEvents] = useState([]);
  const [repos, setRepos] = useState([]);
  const [contributionCalendar, setContributionCalendar] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [, setTimeTick] = useState(0);

  // Custom Hover-Tooltip State for Heatmap Grid Cells
  const [hoveredCell, setHoveredCell] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0, arrowOffset: 0 });
  const matrixRef = useRef(null);

  // Direct client-side fallback fetcher if backend /api/github route is unavailable
  const fetchDirectFromGitHub = useCallback(async () => {
    const ghHeaders = { Accept: 'application/vnd.github.v3+json' };
    const starHeaders = { Accept: 'application/vnd.github.star+json' };

    const [profileRes, eventsRes, reposRes, starredRes, contribRes] = await Promise.all([
      fetch(`https://api.github.com/users/${username}`, { headers: ghHeaders, cache: 'no-store' }).catch(() => null),
      fetch(`https://api.github.com/users/${username}/events/public?per_page=40`, { headers: ghHeaders, cache: 'no-store' }).catch(() => null),
      fetch(`https://api.github.com/users/${username}/repos?sort=pushed&per_page=15`, { headers: ghHeaders, cache: 'no-store' }).catch(() => null),
      fetch(`https://api.github.com/users/${username}/starred?per_page=10`, { headers: starHeaders, cache: 'no-store' }).catch(() => null),
      fetch(`https://github-contributions-api.jogruber.de/v4/${username}?y=last`, { cache: 'no-store' }).catch(() => null),
    ]);

    const rateLimited =
      profileRes?.status === 403 || eventsRes?.status === 403 || reposRes?.status === 403;

    const profileData = profileRes?.ok ? await profileRes.json() : null;
    const reposData = reposRes?.ok ? await reposRes.json() : [];
    const eventsData = eventsRes?.ok ? await eventsRes.json() : [];
    const starredData = starredRes?.ok ? await starredRes.json() : [];
    const contribData = contribRes?.ok ? await contribRes.json() : null;

    const sortedRepos = Array.isArray(reposData)
      ? [...reposData].sort(
          (a, b) =>
            new Date(b.pushed_at || b.updated_at || 0).getTime() -
            new Date(a.pushed_at || a.updated_at || 0).getTime()
        )
      : [];

    // Fetch latest commits from top 3 pushed repos so commit messages & today's commits are real
    const repoCommitsMap = new Map();
    const synthesizedPushEvents = [];

    if (!rateLimited && sortedRepos.length > 0) {
      await Promise.all(
        sortedRepos.slice(0, 3).map(async (repo) => {
          const fullName = repo.full_name || `${username}/${repo.name}`;
          try {
            const cRes = await fetch(`https://api.github.com/repos/${fullName}/commits?per_page=5`, {
              headers: ghHeaders,
              cache: 'no-store',
            });
            if (cRes.ok) {
              const cList = await cRes.json();
              if (Array.isArray(cList) && cList.length > 0) {
                repoCommitsMap.set(fullName.toLowerCase(), cList);
                const branchName = repo.default_branch || 'main';
                const commitsByDay = new Map();

                for (const c of cList) {
                  const sha = c.sha;
                  const message = c.commit?.message?.split('\n')[0] || 'Updated repository code';
                  const dateIso =
                    c.commit?.author?.date ||
                    c.commit?.committer?.date ||
                    repo.pushed_at ||
                    new Date().toISOString();
                  const dayKey = dateIso.split('T')[0];

                  if (!commitsByDay.has(dayKey)) {
                    commitsByDay.set(dayKey, {
                      latestDate: dateIso,
                      headSha: sha,
                      commits: [],
                    });
                  }
                  commitsByDay.get(dayKey).commits.push({ sha, message });
                }

                for (const [dayKey, group] of commitsByDay.entries()) {
                  synthesizedPushEvents.push({
                    id: `push_${repo.id}_${dayKey}_${group.headSha.slice(0, 7)}`,
                    sha: group.headSha,
                    allShas: group.commits.map((cm) => cm.sha),
                    type: 'PushEvent',
                    created_at: group.latestDate,
                    repo: { name: fullName },
                    normalizedBranch: branchName,
                    payload: {
                      ref: `refs/heads/${branchName}`,
                      head: group.headSha,
                      commits: group.commits,
                    },
                  });
                }
              }
            }
          } catch {
            // ignore individual repo commit error
          }
        })
      );
    }

    const pushEvents = [];
    const createEvents = [];
    const otherEvents = [];

    const seenShas = new Set();
    const seenCreateKeys = new Set();
    const seenOtherKeys = new Set();

    if (Array.isArray(eventsData)) {
      for (const ev of eventsData) {
        const repoFullName = ev.repo?.name || `${username}/Repository`;
        const cleanName = repoFullName.replace(new RegExp(`^${username}/`, 'i'), '');
        const branch = ev.payload?.ref ? ev.payload.ref.replace(/^refs\/heads\//, '') : 'main';
        const headSha = ev.payload?.head;

        if (ev.type === 'PushEvent') {
          let commits = Array.isArray(ev.payload?.commits) ? [...ev.payload.commits] : [];
          if (commits.length === 0) {
            const knownCommits = repoCommitsMap.get(repoFullName.toLowerCase()) || [];
            const matched = headSha
              ? knownCommits.find((c) => c.sha === headSha || c.sha?.startsWith(headSha))
              : null;
            if (matched) {
              seenShas.add(matched.sha);
              commits = [
                {
                  sha: matched.sha,
                  message:
                    matched.commit?.message?.split('\n')[0] ||
                    `Pushed commit ${matched.sha.slice(0, 7)} to ${cleanName}`,
                },
              ];
            } else if (headSha) {
              seenShas.add(headSha);
              commits = [
                {
                  sha: headSha,
                  message: `Pushed commit ${headSha.slice(0, 7)} to ${branch} in ${cleanName}`,
                },
              ];
            } else {
              commits = [{ message: `Committed changes to ${branch} branch in ${cleanName}` }];
            }
          } else {
            commits.forEach((c) => {
              if (c.sha) seenShas.add(c.sha);
            });
          }

          pushEvents.push({
            ...ev,
            normalizedBranch: branch,
            payload: {
              ...ev.payload,
              commits,
            },
          });
        } else if (ev.type === 'CreateEvent') {
          const refType = ev.payload?.ref_type || 'branch';
          seenCreateKeys.add(`${repoFullName.toLowerCase()}_${refType}_${branch}`);
          createEvents.push({
            ...ev,
            normalizedBranch: branch,
            payload: {
              ...ev.payload,
              ref_type: refType,
            },
          });
        } else {
          seenOtherKeys.add(`${ev.type}_${repoFullName.toLowerCase()}`);
          otherEvents.push({
            ...ev,
            normalizedBranch: branch,
          });
        }
      }
    }

    for (const syn of synthesizedPushEvents) {
      const alreadyIncluded = (syn.allShas || [syn.sha]).some((s) => seenShas.has(s));
      if (!alreadyIncluded) {
        (syn.allShas || [syn.sha]).forEach((s) => seenShas.add(s));
        pushEvents.push(syn);
      }
    }

    // Enrich Created events from user's real GitHub repositories
    if (Array.isArray(reposData)) {
      const reposByCreated = [...reposData].sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );
      for (const repo of reposByCreated.slice(0, 8)) {
        const fullName = repo.full_name || `${username}/${repo.name}`;
        const branch = repo.default_branch || 'main';
        const repoKey = `${fullName.toLowerCase()}_repository_${branch}`;
        if (!seenCreateKeys.has(repoKey)) {
          seenCreateKeys.add(repoKey);
          createEvents.push({
            id: `create_repo_${repo.id}`,
            type: 'CreateEvent',
            created_at: repo.created_at || repo.pushed_at || new Date().toISOString(),
            repo: { name: fullName },
            normalizedBranch: branch,
            payload: {
              ref_type: 'repository',
              ref: branch,
              description:
                repo.description || `Initialized ${repo.name} repository (${repo.language || 'Full-Stack'})`,
              language: repo.language,
            },
          });
        }
      }
    }

    // Enrich Other events from user's real starred repositories
    if (Array.isArray(starredData)) {
      for (const starItem of starredData) {
        const starredRepo = starItem.repo || starItem;
        const fullName = starredRepo?.full_name;
        if (!fullName) continue;
        const key = `WatchEvent_${fullName.toLowerCase()}`;
        if (!seenOtherKeys.has(key)) {
          seenOtherKeys.add(key);
          otherEvents.push({
            id: `star_${starredRepo.id}`,
            type: 'WatchEvent',
            created_at:
              starItem.starred_at ||
              starredRepo.updated_at ||
              starredRepo.created_at ||
              new Date().toISOString(),
            repo: { name: fullName },
            payload: {
              action: 'started',
              description: starredRepo.description || '',
              language: starredRepo.language || '',
              stargazers_count: starredRepo.stargazers_count || 0,
            },
          });
        }
      }
    }

    const sortByDateDesc = (a, b) =>
      new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();

    pushEvents.sort(sortByDateDesc);
    createEvents.sort(sortByDateDesc);
    otherEvents.sort(sortByDateDesc);

    const balancedEvents = [
      ...pushEvents.slice(0, 14),
      ...createEvents.slice(0, 8),
      ...otherEvents.slice(0, 8),
    ].sort(sortByDateDesc);

    return {
      profile: profileData,
      repos: sortedRepos,
      events: balancedEvents,
      contributions: contribData,
      isRateLimited: rateLimited && balancedEvents.length === 0,
    };
  }, [username]);

  const fetchData = useCallback(
    async (forceRefresh = false) => {
      setIsLoading(true);
      setIsRateLimited(false);

      try {
        const query = forceRefresh ? '?refresh=1' : '';
        const backendRes = await fetch(buildApiUrl(`/api/github/${username}${query}`), {
          cache: 'no-store',
        }).catch(() => null);

        let result = null;
        if (backendRes && backendRes.ok) {
          const json = await backendRes.json();
          if (json && json.success) {
            result = json;
          }
        }

        if (!result) {
          result = await fetchDirectFromGitHub();
        }

        if (result.profile) {
          setProfile(result.profile);
        }

        if (Array.isArray(result.repos) && result.repos.length > 0) {
          const nonProfileRepos = result.repos.filter(
            (r) => r.name?.toLowerCase() !== username.toLowerCase()
          );
          setRepos((nonProfileRepos.length >= 4 ? nonProfileRepos : result.repos).slice(0, 4));
        }

        if (result.contributions && Array.isArray(result.contributions.contributions)) {
          setContributionCalendar(result.contributions);
        }

        if (Array.isArray(result.events) && result.events.length > 0) {
          setEvents(result.events);
          setIsRateLimited(false);
        } else {
          setIsRateLimited(Boolean(result.isRateLimited));
          setEvents((prev) => (prev.length > 0 ? prev : fallbackActivities));
        }

        setLastUpdated(result.syncedAt ? new Date(result.syncedAt) : new Date());
      } catch (err) {
        console.warn('GitHub real-time sync fallback note:', err);
        setEvents((prev) => (prev.length > 0 ? prev : fallbackActivities));
      } finally {
        setIsLoading(false);
      }
    },
    [username, fetchDirectFromGitHub]
  );

  // Initial fetch + real-time 60s polling + window focus re-sync
  useEffect(() => {
    fetchData(false);

    const pollInterval = setInterval(() => {
      fetchData(false);
    }, 60 * 1000);

    const tickInterval = setInterval(() => {
      setTimeTick((t) => t + 1);
    }, 30 * 1000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchData(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(pollInterval);
      clearInterval(tickInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchData]);

  const formatRelativeTime = (isoString) => {
    if (!isoString) return 'recently';
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffSeconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));

      if (diffSeconds < 60) return 'just now';
      const diffMinutes = Math.floor(diffSeconds / 60);
      if (diffMinutes < 60) return `${diffMinutes}m ago`;
      const diffHours = Math.floor(diffMinutes / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 30) return `${diffDays}d ago`;
      const diffMonths = Math.floor(diffDays / 30);
      if (diffMonths < 12) return `${diffMonths}mo ago`;
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return 'recently';
    }
  };

  // Total yearly contributions from real GitHub contribution calendar
  const totalYearlyContributions = useMemo(() => {
    if (contributionCalendar?.total?.lastYear !== undefined) {
      return contributionCalendar.total.lastYear;
    }
    if (Array.isArray(contributionCalendar?.contributions)) {
      return contributionCalendar.contributions.reduce((sum, d) => sum + (d.count || 0), 0);
    }
    return null;
  }, [contributionCalendar]);

  // Build 42 days (6 weeks x 7 days) of real daily contribution history
  const heatmapDays = useMemo(() => {
    const days = [];
    const totalDays = 42;
    const now = new Date();

    const calendarByDate = {};
    const hasRealCalendar =
      Array.isArray(contributionCalendar?.contributions) &&
      contributionCalendar.contributions.length > 0;

    if (hasRealCalendar) {
      contributionCalendar.contributions.forEach((item) => {
        if (item.date) {
          calendarByDate[item.date] = {
            count: Number(item.count) || 0,
            level: Number(item.level) || 0,
          };
        }
      });
    }

    const eventCountsByDate = {};
    if (Array.isArray(events)) {
      events.forEach((ev) => {
        if (ev.created_at) {
          const key = ev.created_at.split('T')[0];
          const count =
            ev.type === 'PushEvent' && ev.payload?.commits
              ? Math.max(ev.payload.commits.length, 1)
              : 1;
          eventCountsByDate[key] = (eventCountsByDate[key] || 0) + count;
        }
      });
    }

    for (let i = totalDays - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      const isoDate = date.toISOString().split('T')[0];

      const formattedDate = date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      const exactDateLabel = date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      const calEntry = calendarByDate[isoDate];
      const liveEventCount = eventCountsByDate[isoDate] || 0;

      const count = hasRealCalendar
        ? Math.max(calEntry ? calEntry.count : 0, i <= 1 ? liveEventCount : 0)
        : liveEventCount;

      let levelClass = 'level-0';
      if (calEntry && calEntry.level > 0 && count === calEntry.count) {
        levelClass = `level-${Math.min(4, Math.max(1, calEntry.level))}`;
      } else if (count === 1) {
        levelClass = 'level-1';
      } else if (count === 2) {
        levelClass = 'level-2';
      } else if (count >= 3 && count <= 4) {
        levelClass = 'level-3';
      } else if (count >= 5) {
        levelClass = 'level-4';
      }

      days.push({
        id: isoDate,
        date,
        formattedDate,
        exactDateLabel,
        count,
        levelClass,
      });
    }

    return days;
  }, [contributionCalendar, events]);

  const handleCellHover = (day, e) => {
    if (!matrixRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const matrixRect = matrixRef.current.getBoundingClientRect();

    const rawLeft = rect.left - matrixRect.left + rect.width / 2;
    // Dynamically adapt half-width clamping for small mobile screens vs desktop
    const halfTooltipEstimate = matrixRect.width < 340 ? 78 : 96;
    const minLeft = Math.min(halfTooltipEstimate, matrixRect.width / 2);
    const maxLeft = Math.max(minLeft, matrixRect.width - halfTooltipEstimate);
    const clampedLeft = Math.max(minLeft, Math.min(rawLeft, maxLeft));
    const arrowOffset = Math.max(
      -(halfTooltipEstimate - 14),
      Math.min(halfTooltipEstimate - 14, rawLeft - clampedLeft)
    );

    setTooltipPos({
      left: clampedLeft,
      top: rect.top - matrixRect.top - 10,
      arrowOffset,
    });
    setHoveredCell(day);
  };

  const activeEventsList = events.length > 0 ? events : fallbackActivities;

  const pushCount = useMemo(
    () => activeEventsList.filter((e) => e.type === 'PushEvent').length,
    [activeEventsList]
  );
  const createCount = useMemo(
    () => activeEventsList.filter((e) => e.type === 'CreateEvent').length,
    [activeEventsList]
  );
  const otherCount = useMemo(
    () => activeEventsList.filter((e) => e.type !== 'PushEvent' && e.type !== 'CreateEvent').length,
    [activeEventsList]
  );

  const filteredEvents = useMemo(() => {
    return activeEventsList.filter((ev) => {
      if (filterType === 'all') return true;
      if (filterType === 'push') return ev.type === 'PushEvent';
      if (filterType === 'create') return ev.type === 'CreateEvent';
      if (filterType === 'other') return ev.type !== 'PushEvent' && ev.type !== 'CreateEvent';
      return true;
    });
  }, [activeEventsList, filterType]);

  const getEventBadge = (type, payload = {}) => {
    switch (type) {
      case 'PushEvent':
        return {
          icon: 'fas fa-code-commit',
          label: 'Code Push',
          color: '#3b82f6',
        };
      case 'CreateEvent':
        return {
          icon: payload?.ref_type === 'repository' ? 'fas fa-folder-plus' : 'fas fa-code-branch',
          label: payload?.ref_type === 'repository' ? 'New Repository' : 'Branch Created',
          color: '#10b981',
        };
      case 'WatchEvent':
        return {
          icon: 'fas fa-star',
          label: 'Starred Repo',
          color: '#f59e0b',
        };
      case 'ForkEvent':
        return {
          icon: 'fas fa-code-fork',
          label: 'Forked Repo',
          color: '#8b5cf6',
        };
      case 'PullRequestEvent':
        return {
          icon: 'fas fa-code-pull-request',
          label: 'Pull Request',
          color: '#ec4899',
        };
      case 'IssuesEvent':
        return {
          icon: 'fas fa-circle-dot',
          label: 'Issue Update',
          color: '#ef4444',
        };
      case 'ReleaseEvent':
        return {
          icon: 'fas fa-tag',
          label: 'Release',
          color: '#06b6d4',
        };
      default:
        return {
          icon: 'fab fa-github',
          label: 'GitHub Event',
          color: '#64748b',
        };
    }
  };

  return (
    <section id="github-contributions" className="github-section">
      <SectionTechBackground type="github" />
      <div className="container">
        <div className="section-header-center">
          <h2 className="section-title">
            <span className="section-title-icon-badge" aria-hidden="true">
              <Activity className="section-title-icon" size={24} strokeWidth={2.2} />
            </span>
            <span className="section-title-text">GitHub Contributions</span>
          </h2>
          <p className="github-subtitle">
            Real-time open source updates, repository commits, and daily contribution activity fetched live from GitHub
          </p>
        </div>

        {/* Profile Card & Stats Header */}
        <div className="github-profile-card">
          <div className="github-profile-main">
            <img
              src={profile?.avatar_url || 'https://avatars.githubusercontent.com/u/187780474?v=4'}
              alt={profile?.name || username}
              className="github-avatar"
            />
            <div className="github-profile-info">
              <div className="github-user-names">
                <h3>{profile?.name || 'Sachin Kumar'}</h3>
                <span className="github-handle">@{profile?.login || username}</span>
              </div>
              <p className="github-bio">
                {profile?.bio || 'Building intelligent AI/ML models and modern full-stack web applications.'}
              </p>
              <span className="github-location">
                <i className="fas fa-location-dot"></i> {profile?.location || 'India (Remote)'}
              </span>
            </div>
          </div>

          <div className="github-stats-grid">
            <div className="github-stat-box">
              <span className="github-stat-num">{profile?.public_repos ?? 26}</span>
              <span className="github-stat-label">Repositories</span>
            </div>
            <div className="github-stat-box">
              <span className="github-stat-num">{profile?.followers ?? 8}</span>
              <span className="github-stat-label">Followers</span>
            </div>
            <div className="github-stat-box">
              <span className="github-stat-num">
                {totalYearlyContributions !== null ? totalYearlyContributions : `${activeEventsList.length}+`}
              </span>
              <span className="github-stat-label">
                {totalYearlyContributions !== null ? 'Yearly Contribs' : 'Recent Events'}
              </span>
            </div>
          </div>

          <div className="github-card-actions">
            <button
              type="button"
              className="github-refresh-btn"
              onClick={() => fetchData(true)}
              disabled={isLoading}
              title="Force live refresh from GitHub"
            >
              <i className={`fas fa-rotate ${isLoading ? 'fa-spin' : ''}`}></i>
              <span>{isLoading ? 'Syncing...' : 'Refresh'}</span>
            </button>

            <a
              href={`https://github.com/${username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="github-profile-link-btn"
            >
              <i className="fab fa-github"></i>
              <span>View Profile</span>
            </a>
          </div>
        </div>

        {/* Rate limit notification if API is rate limited */}
        {isRateLimited && (
          <div className="github-notice-banner">
            <i className="fas fa-circle-info"></i>
            <span>
              Live GitHub API rate threshold reached. Serving cached project activities for @{username}.
            </span>
          </div>
        )}

        {/* Main Content: Activity Timeline & Recent Repos */}
        <div className="github-content-layout">
          {/* Left Column: Recent Activity Feed */}
          <div className="github-activity-column">
            <div className="github-column-header">
              <h3>
                <i className="fas fa-chart-line"></i>
                <span>Recent Activity</span>
              </h3>

              {/* Filter Tabs */}
              <div className="github-filter-pills" role="tablist" aria-label="Filter recent GitHub activity">
                <button
                  type="button"
                  role="tab"
                  aria-selected={filterType === 'all'}
                  className={`github-filter-pill ${filterType === 'all' ? 'active' : ''}`}
                  onClick={() => setFilterType('all')}
                >
                  All ({activeEventsList.length})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={filterType === 'push'}
                  className={`github-filter-pill ${filterType === 'push' ? 'active' : ''}`}
                  onClick={() => setFilterType('push')}
                >
                  Pushes ({pushCount})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={filterType === 'create'}
                  className={`github-filter-pill ${filterType === 'create' ? 'active' : ''}`}
                  onClick={() => setFilterType('create')}
                >
                  Created ({createCount})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={filterType === 'other'}
                  className={`github-filter-pill ${filterType === 'other' ? 'active' : ''}`}
                  onClick={() => setFilterType('other')}
                >
                  Other ({otherCount})
                </button>
              </div>
            </div>

            {isLoading && activeEventsList.length === 0 ? (
              <div className="github-loading-state">
                <i className="fas fa-circle-notch fa-spin"></i>
                <p>Loading live GitHub contributions...</p>
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="github-empty-state">
                <i className="fab fa-github"></i>
                <p>No recent activity found for this filter.</p>
              </div>
            ) : (
              <div className="github-timeline">
                {filteredEvents.slice(0, 12).map((event) => {
                  const badge = getEventBadge(event.type, event.payload);
                  const cleanRepoName = event.repo?.name
                    ? event.repo.name.replace(new RegExp(`^${username}/`, 'i'), '')
                    : 'Repository';
                  const repoUrl = `https://github.com/${event.repo?.name || username}`;
                  const branchName =
                    event.normalizedBranch ||
                    (event.payload?.ref ? event.payload.ref.replace(/^refs\/heads\//, '') : 'main');

                  return (
                    <div key={event.id} className="github-timeline-item">
                      <div
                        className="github-timeline-icon"
                        style={{ backgroundColor: `${badge.color}15`, color: badge.color }}
                      >
                        <i className={badge.icon}></i>
                      </div>

                      <div className="github-timeline-content">
                        <div className="github-timeline-header">
                          <span
                            className="github-event-type-badge"
                            style={{
                              backgroundColor: `${badge.color}15`,
                              color: badge.color,
                              borderColor: `${badge.color}30`,
                            }}
                          >
                            {badge.label}
                          </span>
                          <span className="github-timeline-time">
                            {formatRelativeTime(event.created_at)}
                          </span>
                        </div>

                        <div className="github-timeline-action">
                          {event.type === 'PushEvent' && (
                            <>
                              Pushed to{' '}
                              <span className="github-branch-tag">
                                <i className="fas fa-code-branch"></i> {branchName}
                              </span>{' '}
                              at{' '}
                              <a
                                href={repoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="github-repo-link"
                              >
                                {cleanRepoName}
                              </a>
                            </>
                          )}

                          {event.type === 'CreateEvent' && (
                            <>
                              {event.payload?.ref_type === 'repository' ? (
                                <>
                                  Created repository{' '}
                                  <a
                                    href={repoUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="github-repo-link"
                                  >
                                    {cleanRepoName}
                                  </a>{' '}
                                  on branch{' '}
                                  <span className="github-branch-tag">
                                    <i className="fas fa-code-branch"></i> {branchName}
                                  </span>
                                </>
                              ) : (
                                <>
                                  Created {event.payload?.ref_type || 'branch'}{' '}
                                  {branchName && (
                                    <span className="github-branch-tag">
                                      <i className="fas fa-code-branch"></i> {branchName}
                                    </span>
                                  )}{' '}
                                  in{' '}
                                  <a
                                    href={repoUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="github-repo-link"
                                  >
                                    {cleanRepoName}
                                  </a>
                                </>
                              )}
                            </>
                          )}

                          {event.type === 'WatchEvent' && (
                            <>
                              Starred repository{' '}
                              <a
                                href={repoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="github-repo-link"
                              >
                                {event.repo?.name || cleanRepoName}
                              </a>
                            </>
                          )}

                          {event.type === 'ForkEvent' && (
                            <>
                              Forked repository{' '}
                              <a
                                href={repoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="github-repo-link"
                              >
                                {event.repo?.name || cleanRepoName}
                              </a>
                            </>
                          )}

                          {event.type === 'PullRequestEvent' && (
                            <>
                              {event.payload?.action === 'closed' ? 'Merged / closed' : 'Opened'} pull request in{' '}
                              <a
                                href={repoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="github-repo-link"
                              >
                                {cleanRepoName}
                              </a>
                            </>
                          )}

                          {event.type !== 'PushEvent' &&
                            event.type !== 'CreateEvent' &&
                            event.type !== 'WatchEvent' &&
                            event.type !== 'ForkEvent' &&
                            event.type !== 'PullRequestEvent' && (
                              <>
                                Updated{' '}
                                <a
                                  href={repoUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="github-repo-link"
                                >
                                  {cleanRepoName}
                                </a>
                              </>
                            )}
                        </div>

                        {/* Commits detail snippets for PushEvent */}
                        {event.payload?.commits && event.payload.commits.length > 0 && (
                          <div className="github-commits-list">
                            {event.payload.commits.slice(0, 2).map((commit, cIdx) => (
                              <div key={cIdx} className="github-commit-item">
                                <span className="github-commit-bullet">▸</span>
                                <span className="github-commit-message">{commit.message}</span>
                              </div>
                            ))}
                            {event.payload.commits.length > 2 && (
                              <span className="github-more-commits">
                                +{event.payload.commits.length - 2} more commit
                                {event.payload.commits.length - 2 === 1 ? '' : 's'}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Rich detail snippet for Created and Other (Starred / Forked / PR) events */}
                        {(!event.payload?.commits || event.payload.commits.length === 0) &&
                          (event.payload?.description ||
                            event.payload?.pull_request?.title ||
                            event.payload?.language) && (
                            <div className="github-commits-list">
                              {event.payload?.pull_request?.title && (
                                <div className="github-commit-item">
                                  <span className="github-commit-bullet">▸</span>
                                  <span className="github-commit-message">
                                    {event.payload.pull_request.title}
                                  </span>
                                </div>
                              )}
                              {event.payload?.description && (
                                <div className="github-commit-item">
                                  <span className="github-commit-bullet">▸</span>
                                  <span className="github-commit-message">
                                    {event.payload.description}
                                  </span>
                                </div>
                              )}
                              {event.payload?.language && (
                                <span className="github-more-commits">
                                  Primary stack: {event.payload.language}
                                </span>
                              )}
                            </div>
                          )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Active Repositories & Visual Activity Matrix */}
          <div className="github-repos-column">
            <div className="github-column-header">
              <h3>
                <i className="fas fa-bookmark"></i>
                <span>Active Repositories</span>
              </h3>
              <a
                href={`https://github.com/${username}?tab=repositories`}
                target="_blank"
                rel="noopener noreferrer"
                className="github-view-all-link"
              >
                View all <i className="fas fa-arrow-right"></i>
              </a>
            </div>

            <div className="github-repos-list">
              {(repos.length > 0
                ? repos
                : [
                    {
                      id: 1,
                      name: 'sachin-portfolio',
                      description:
                        'Full-stack personal portfolio and Admin CMS built with React, Vite, Node.js, Express, and MongoDB.',
                      html_url: 'https://github.com/Sachin2501/sachin-portfolio',
                      language: 'JavaScript',
                      stargazers_count: 1,
                      forks_count: 0,
                      pushed_at: '2026-11-12T09:54:35Z',
                    },
                    {
                      id: 2,
                      name: 'portfolio_website.io',
                      description:
                        'Personal responsive portfolio website built with modern React & JavaScript.',
                      html_url: 'https://github.com/Sachin2501/portfolio_website.io',
                      language: 'HTML',
                      stargazers_count: 1,
                      forks_count: 0,
                      pushed_at: '2026-11-09T13:09:31Z',
                    },
                    {
                      id: 3,
                      name: 'FloodLearn-Tracker',
                      description:
                        'Interactive tracker and informational system for flood tracking and mitigation.',
                      html_url: 'https://github.com/Sachin2501/FloodLearn-Tracker',
                      language: 'TypeScript',
                      stargazers_count: 0,
                      forks_count: 0,
                      pushed_at: '2026-10-30T05:56:23Z',
                    },
                    {
                      id: 4,
                      name: 'AIDriven-Archaeological-Site-Mapping',
                      description:
                        'AI platform for classifying vegetation land and soil types for archaeological research.',
                      html_url: 'https://github.com/Sachin2501/AIDriven-Archaeological-Site-Mapping',
                      language: 'JavaScript',
                      stargazers_count: 0,
                      forks_count: 0,
                      pushed_at: '2026-01-07T14:31:54Z',
                    },
                  ]
              ).map((repo) => (
                <a
                  key={repo.id}
                  href={repo.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="github-repo-card"
                >
                  <div className="github-repo-card-top">
                    <h4>
                      <i className="fas fa-book-bookmark"></i> {repo.name}
                    </h4>
                    <span className="github-repo-external-icon">
                      <i className="fas fa-external-link-alt"></i>
                    </span>
                  </div>

                  <p className="github-repo-desc">
                    {repo.description || 'Active open-source software repository by Sachin Kumar.'}
                  </p>

                  <div className="github-repo-card-footer">
                    {repo.language && (
                      <span className="github-lang-badge">
                        <span className="github-lang-dot"></span>
                        {repo.language}
                      </span>
                    )}

                    <div className="github-repo-meta">
                      {repo.stargazers_count > 0 && (
                        <span>
                          <i className="fas fa-star"></i> {repo.stargazers_count}
                        </span>
                      )}
                      {repo.forks_count > 0 && (
                        <span>
                          <i className="fas fa-code-fork"></i> {repo.forks_count}
                        </span>
                      )}
                      <span>
                        <i className="fas fa-clock"></i>{' '}
                        {formatRelativeTime(repo.pushed_at || repo.updated_at)}
                      </span>
                    </div>
                  </div>
                </a>
              ))}
            </div>

            {/* Visual Contribution Tracker Box */}
            <div className="github-matrix-card" ref={matrixRef}>
              {/* Custom High-Contrast Hover Tooltip for Heatmap Grid Cells */}
              {hoveredCell && (
                <div
                  className="github-heatmap-tooltip"
                  style={{
                    left: `${tooltipPos.left}px`,
                    top: `${tooltipPos.top}px`,
                  }}
                  role="tooltip"
                >
                  <div className="tooltip-count-row">
                    <span className={`tooltip-level-dot ${hoveredCell.levelClass}`} />
                    <span className="tooltip-count">
                      {hoveredCell.count === 0
                        ? '0 commits'
                        : `${hoveredCell.count} commit${hoveredCell.count === 1 ? '' : 's'}`}
                    </span>
                  </div>
                  <div className="tooltip-date">
                    {hoveredCell.exactDateLabel} ({hoveredCell.id})
                  </div>
                  <div
                    className="tooltip-arrow"
                    style={{
                      left: `calc(50% + ${tooltipPos.arrowOffset || 0}px)`,
                    }}
                  />
                </div>
              )}

              <div className="github-matrix-header">
                <div>
                  <h4>Contribution Habit</h4>
                  <p>
                    {hoveredCell ? (
                      <span className="heatmap-header-stat">
                        <strong>
                          {hoveredCell.count === 0
                            ? '0 commits'
                            : `${hoveredCell.count} commit${hoveredCell.count === 1 ? '' : 's'}`}
                        </strong>{' '}
                        on {hoveredCell.formattedDate}
                      </span>
                    ) : totalYearlyContributions !== null ? (
                      `${totalYearlyContributions} contributions in the last year · Last 6 weeks shown`
                    ) : (
                      'Weekly commit frequency and daily code contributions'
                    )}
                  </p>
                </div>
                <span className="github-pulse-badge">
                  <span className="github-pulse-dot"></span> Live Sync
                </span>
              </div>

              {/* Interactive Contribution Heatmap Squares */}
              <div className="github-heatmap-container">
                <div
                  className="github-heatmap-grid"
                  role="grid"
                  aria-label="GitHub contribution activity by day"
                  onMouseLeave={() => setHoveredCell(null)}
                >
                  {heatmapDays.map((day) => (
                    <div
                      key={day.id}
                      className={`github-heatmap-cell ${day.levelClass} ${
                        hoveredCell?.id === day.id ? 'is-hovered' : ''
                      }`}
                      onMouseEnter={(e) => handleCellHover(day, e)}
                      onMouseMove={(e) => handleCellHover(day, e)}
                      onMouseLeave={() => setHoveredCell(null)}
                      onClick={(e) => handleCellHover(day, e)}
                      onTouchStart={(e) => handleCellHover(day, e)}
                      onFocus={(e) => handleCellHover(day, e)}
                      onBlur={() => setHoveredCell(null)}
                      tabIndex={0}
                      role="gridcell"
                      aria-label={`${day.count} commit${day.count === 1 ? '' : 's'} on ${day.exactDateLabel}`}
                    />
                  ))}
                </div>
              </div>

              <div className="github-heatmap-legend">
                <span>Less</span>
                <span className="github-heatmap-cell level-0" aria-hidden="true"></span>
                <span className="github-heatmap-cell level-1" aria-hidden="true"></span>
                <span className="github-heatmap-cell level-2" aria-hidden="true"></span>
                <span className="github-heatmap-cell level-3" aria-hidden="true"></span>
                <span className="github-heatmap-cell level-4" aria-hidden="true"></span>
                <span>More</span>
              </div>

              <div className="github-matrix-footer">
                <span className="github-last-synced">
                  Synced: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <a
                  href={`https://github.com/${username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="github-graph-link"
                >
                  View full graph on GitHub →
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default GitHubContributions;
