import { Router } from 'express';

export const githubRouter = Router();

// In-memory cache per username to prevent hitting GitHub API rate limits while keeping data fresh
const githubCache = new Map();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds fresh TTL

const getHeaders = (extra = {}) => {
  const headers = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Sachin-Portfolio-Realtime-Engine',
    ...extra,
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
};

async function fetchJsonSafe(url, headers = {}) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    const res = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) {
      return { ok: false, status: res.status, data: null };
    }
    const data = await res.json();
    return { ok: true, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, error: err.message, data: null };
  }
}

githubRouter.get('/:username', async (req, res) => {
  const username = (req.params.username || 'Sachin2501').trim();
  const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';
  const cacheKey = username.toLowerCase();
  const cached = githubCache.get(cacheKey);

  if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return res.json({
      ...cached.payload,
      cached: true,
      syncedAt: cached.payload.syncedAt,
    });
  }

  const ghHeaders = getHeaders();
  const starHeaders = getHeaders({ Accept: 'application/vnd.github.star+json' });

  try {
    const [profileResp, reposResp, eventsResp, starredResp, contribResp] = await Promise.all([
      fetchJsonSafe(`https://api.github.com/users/${encodeURIComponent(username)}`, ghHeaders),
      fetchJsonSafe(
        `https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=pushed&per_page=15`,
        ghHeaders
      ),
      fetchJsonSafe(
        `https://api.github.com/users/${encodeURIComponent(username)}/events/public?per_page=40`,
        ghHeaders
      ),
      fetchJsonSafe(
        `https://api.github.com/users/${encodeURIComponent(username)}/starred?per_page=10`,
        starHeaders
      ),
      fetchJsonSafe(
        `https://github-contributions-api.jogruber.de/v4/${encodeURIComponent(username)}?y=last`
      ),
    ]);

    const isRateLimited =
      profileResp.status === 403 || reposResp.status === 403 || eventsResp.status === 403;

    if (isRateLimited && cached?.payload) {
      const updatedPayload = {
        ...cached.payload,
        contributions:
          contribResp.ok && contribResp.data ? contribResp.data : cached.payload.contributions,
        isRateLimited: false,
        cached: true,
        syncedAt: new Date().toISOString(),
      };
      return res.json(updatedPayload);
    }

    const profile = profileResp.ok ? profileResp.data : cached?.payload?.profile || null;
    const rawRepos = Array.isArray(reposResp.data)
      ? reposResp.data
      : cached?.payload?.repos || [];

    // Sort repositories strictly by latest push timestamp descending
    const sortedRepos = [...rawRepos].sort((a, b) => {
      const tA = new Date(a.pushed_at || a.updated_at || 0).getTime();
      const tB = new Date(b.pushed_at || b.updated_at || 0).getTime();
      return tB - tA;
    });

    // Fetch real latest commits from top 4 most recently pushed repositories
    const topReposForCommits = sortedRepos.slice(0, 4);
    const repoCommitsMap = new Map();
    const synthesizedPushEvents = [];

    if (!isRateLimited && topReposForCommits.length > 0) {
      await Promise.all(
        topReposForCommits.map(async (repo) => {
          const fullName = repo.full_name || `${username}/${repo.name}`;
          const commitsResp = await fetchJsonSafe(
            `https://api.github.com/repos/${fullName}/commits?per_page=5`,
            ghHeaders
          );
          if (commitsResp.ok && Array.isArray(commitsResp.data) && commitsResp.data.length > 0) {
            repoCommitsMap.set(fullName.toLowerCase(), commitsResp.data);
            const branchName = repo.default_branch || 'main';

            // Group commits by date (YYYY-MM-DD) per repo so we create cohesive PushEvents instead of flooding
            const commitsByDay = new Map();
            for (const c of commitsResp.data) {
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
              commitsByDay.get(dayKey).commits.push({
                sha,
                message,
                url: c.html_url || `https://github.com/${fullName}/commit/${sha}`,
              });
            }

            for (const [dayKey, group] of commitsByDay.entries()) {
              synthesizedPushEvents.push({
                id: `push_${repo.id}_${dayKey}_${group.headSha.slice(0, 7)}`,
                sha: group.headSha,
                allShas: group.commits.map((c) => c.sha),
                type: 'PushEvent',
                created_at: group.latestDate,
                repo: {
                  name: fullName,
                  url: `https://api.github.com/repos/${fullName}`,
                },
                normalizedBranch: branchName,
                payload: {
                  ref: `refs/heads/${branchName}`,
                  head: group.headSha,
                  commits: group.commits,
                },
              });
            }
          }
        })
      );
    }

    // Separate buckets for Pushes, Created, and Other so every filter tab is well-populated
    const pushEvents = [];
    const createEvents = [];
    const otherEvents = [];

    const seenShas = new Set();
    const seenCreateKeys = new Set();
    const seenOtherKeys = new Set();

    const rawEvents = Array.isArray(eventsResp.data) ? eventsResp.data : [];

    for (const ev of rawEvents) {
      const repoFullName = ev.repo?.name || `${username}/Repository`;
      const cleanName = repoFullName.replace(new RegExp(`^${username}/`, 'i'), '');
      const branch = ev.payload?.ref ? ev.payload.ref.replace(/^refs\/heads\//, '') : 'main';
      const headSha = ev.payload?.head;

      if (ev.type === 'PushEvent') {
        let commits = Array.isArray(ev.payload?.commits) ? [...ev.payload.commits] : [];
        if (commits.length === 0) {
          const knownCommits = repoCommitsMap.get(repoFullName.toLowerCase()) || [];
          const matchedCommit = headSha
            ? knownCommits.find((c) => c.sha === headSha || c.sha?.startsWith(headSha))
            : null;

          if (matchedCommit) {
            seenShas.add(matchedCommit.sha);
            commits = [
              {
                sha: matchedCommit.sha,
                message:
                  matchedCommit.commit?.message?.split('\n')[0] ||
                  `Pushed commit ${matchedCommit.sha.slice(0, 7)} to ${cleanName}`,
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
        const key = `${repoFullName.toLowerCase()}_${refType}_${branch}`;
        seenCreateKeys.add(key);
        createEvents.push({
          ...ev,
          normalizedBranch: branch,
          payload: {
            ...ev.payload,
            ref_type: refType,
            description: ev.payload?.description || '',
          },
        });
      } else {
        const key = `${ev.type}_${repoFullName.toLowerCase()}`;
        seenOtherKeys.add(key);
        otherEvents.push({
          ...ev,
          normalizedBranch: branch,
        });
      }
    }

    // Add synthesized real commit push events that weren't in rawEvents
    for (const syn of synthesizedPushEvents) {
      const alreadyIncluded = (syn.allShas || [syn.sha]).some((s) => seenShas.has(s));
      if (!alreadyIncluded) {
        (syn.allShas || [syn.sha]).forEach((s) => seenShas.add(s));
        pushEvents.push(syn);
      }
    }

    // Enrich Created events from user's real GitHub repositories (repository & default branch creation)
    const reposByCreated = [...rawRepos].sort(
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
          repo: {
            name: fullName,
            url: repo.url || `https://api.github.com/repos/${fullName}`,
          },
          normalizedBranch: branch,
          payload: {
            ref_type: 'repository',
            ref: branch,
            description: repo.description || `Initialized ${repo.name} repository (${repo.language || 'Full-Stack'})`,
            language: repo.language,
          },
        });
      }
    }

    // Enrich Other events from user's real starred repositories (/users/:username/starred) and forks
    if (starredResp.ok && Array.isArray(starredResp.data)) {
      for (const starItem of starredResp.data) {
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
            repo: {
              name: fullName,
              url: `https://api.github.com/repos/${fullName}`,
            },
            payload: {
              action: 'started',
              description: starredRepo.description || '',
              language: starredRepo.language || '',
              stargazers_count: starredRepo.stargazers_count || 0,
            },
          });
        } else {
          // Enrich existing WatchEvent with repo description & language
          const existing = otherEvents.find(
            (e) => e.type === 'WatchEvent' && e.repo?.name?.toLowerCase() === fullName.toLowerCase()
          );
          if (existing) {
            existing.payload = {
              ...existing.payload,
              description: starredRepo.description || existing.payload?.description || '',
              language: starredRepo.language || '',
              stargazers_count: starredRepo.stargazers_count || 0,
            };
          }
        }
      }
    }

    // Also include forked repositories in Other if any exist
    for (const repo of rawRepos) {
      if (repo.fork) {
        const fullName = repo.full_name || `${username}/${repo.name}`;
        const key = `ForkEvent_${fullName.toLowerCase()}`;
        if (!seenOtherKeys.has(key)) {
          seenOtherKeys.add(key);
          otherEvents.push({
            id: `fork_${repo.id}`,
            type: 'ForkEvent',
            created_at: repo.created_at || repo.updated_at || new Date().toISOString(),
            repo: { name: fullName },
            payload: {
              description: repo.description || `Forked repository ${repo.name}`,
              language: repo.language || '',
            },
          });
        }
      }
    }

    // Sort each category newest-first and keep a balanced set so all 4 filter tabs have rich live entries
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

    const payload = {
      success: true,
      username,
      isRateLimited: isRateLimited && balancedEvents.length === 0,
      profile,
      repos: sortedRepos,
      events: balancedEvents,
      contributions: contribResp.ok && contribResp.data ? contribResp.data : null,
      syncedAt: new Date().toISOString(),
    };

    if (profile || sortedRepos.length > 0 || balancedEvents.length > 0 || contribResp.ok) {
      githubCache.set(cacheKey, {
        timestamp: Date.now(),
        payload,
      });
    }

    return res.json(payload);
  } catch (err) {
    console.warn('[GitHub API Proxy] Error:', err.message);
    if (cached?.payload) {
      return res.json({ ...cached.payload, cached: true });
    }
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to fetch live GitHub data',
    });
  }
});
