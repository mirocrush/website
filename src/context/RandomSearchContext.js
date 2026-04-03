import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { searchRepos, searchIssues, importIssues } from '../api/smartSearchApi';
import { getSession, updateSession, clearSession } from '../api/searchSessionApi';
import { useAuth } from './AuthContext';

// ── Vocabulary ────────────────────────────────────────────────────────────────
export const WORD_CATEGORIES = {
  'Web Frontend': ['react','vue','angular','svelte','nextjs','nuxtjs','gatsby','astro','tailwind','bootstrap','shadcn','radix','storybook','emotion','styled-components','webpack','vite','rollup','parcel','esbuild','turbo'],
  'Backend & APIs': ['django','flask','fastapi','express','nestjs','fastify','koa','hapi','spring','laravel','rails','gin','fiber','echo','actix','rest','graphql','grpc','websocket','trpc','openapi'],
  'Machine Learning': ['tensorflow','pytorch','keras','scikit','xgboost','lightgbm','catboost','pandas','numpy','scipy','statsmodels','sklearn','polars','huggingface','transformers','diffusers','tokenizers','accelerate','mlflow','wandb','optuna'],
  'AI & LLM': ['openai','langchain','llamaindex','ollama','llama','mistral','gemini','rag','embedding','vector','chatbot','agent','copilot','assistant','anthropic','groq','together','replicate','vllm','litellm','autogen','crewai'],
  'DevOps & CI/CD': ['docker','kubernetes','helm','terraform','ansible','vagrant','packer','github-actions','jenkins','gitlab-ci','circleci','travis','argocd','flux','spinnaker','tekton','drone','woodpecker','dagger','deployment','container'],
  'Cloud & Serverless': ['aws','gcp','azure','cloudflare','vercel','netlify','fly','railway','lambda','serverless','fargate','cloud-run','s3','cloudfront','route53','iam','vpc','eks','gke','aks','pulumi'],
  'Databases': ['postgresql','mysql','mongodb','redis','sqlite','elasticsearch','clickhouse','cassandra','dynamodb','firestore','supabase','neon','turso','prisma','drizzle','sqlalchemy','mongoose','typeorm','sequelize','gorm','pgvector'],
  'Testing & QA': ['pytest','jest','vitest','mocha','chai','jasmine','ava','selenium','playwright','cypress','puppeteer','testcafe','unittest','rspec','phpunit','junit','mock','faker','coverage','mutation','snapshot'],
  'CLI & Terminal Tools': ['cli','terminal','shell','bash','zsh','fish','nushell','click','typer','argparse','commander','yargs','clap','cobra','rich','textual','blessed','ink','chalk','ora','fzf','ripgrep'],
  'Security & Auth': ['oauth','jwt','openid','saml','keycloak','auth0','clerk','supertokens','bcrypt','argon2','passlib','cryptography','tls','ssl','vault','sops','owasp','pentest','nuclei','trivy','semgrep'],
  'Monitoring & Observability': ['prometheus','grafana','loki','tempo','jaeger','zipkin','datadog','newrelic','sentry','opentelemetry','honeycomb','alertmanager','fluentd','logstash','filebeat','vector','alloy','pyroscope','netdata','zabbix'],
  'Data Engineering': ['airflow','prefect','dagster','luigi','kedro','argo','temporal','spark','flink','kafka','pulsar','nats','rabbitmq','dbt','great-expectations','dlt','airbyte','iceberg','delta','parquet','duckdb'],
  'Mobile Development': ['react-native','flutter','expo','ionic','capacitor','android','ios','kotlin','swift','swiftui','jetpack','compose','room','retrofit','glide','coil','realm','firebase','notifications','deeplink'],
  'Systems & Low-Level': ['rust','golang','zig','nim','cpp','tokio','async-std','rayon','crossbeam','wasm','wasmtime','wasmer','emscripten','ebpf','perf','flamegraph','valgrind','asan','miri'],
  'File & Data Processing': ['parser','converter','transformer','pipeline','etl','csv','json','yaml','toml','xml','protobuf','avro','msgpack','pdf','docx','xlsx','markdown','ffmpeg','imagemagick','pillow','compress'],
  'Web Scraping & Automation': ['scrapy','beautifulsoup','httpx','aiohttp','requests','playwright','puppeteer','selenium','mechanize','scraper','crawler','spider','extractor','harvester','rpa','robocorp','n8n','workflow'],
  'Game Development': ['pygame','godot','unity','raylib','bevy','ggez','macroquad','phaser','three','babylonjs','pixi','kaboom','physics','collision','sprite','tilemap','pathfinding','ecs','scene','shader'],
  'Blockchain & Web3': ['ethereum','solidity','hardhat','foundry','brownie','web3','ethers','viem','wagmi','rainbowkit','thirdweb','defi','nft','dao','token','erc20','bitcoin','cosmos','solana','polkadot'],
  'Finance & Trading': ['trading','backtesting','quant','algotrading','fintech','ta-lib','zipline','backtrader','freqtrade','payment','stripe','plaid','open-banking','invoice','portfolio','risk','factor','signal'],
  'Desktop & GUI': ['electron','tauri','neutralino','nwjs','wails','fyne','tkinter','wxpython','pyqt','pyside','kivy','gtk','qt','imgui','egui','iced','slint','tray','systray','notification'],
  'Build & Package Tools': ['poetry','uv','pip','conda','pixi','pdm','cargo','npm','yarn','pnpm','bun','deno','bazel','buck','cmake','meson','make','nix','flatpak','snap'],
  'Education & Starters': ['tutorial','example','demo','boilerplate','starter','template','scaffold','beginner','learning','course','workshop','awesome','cookbook','patterns','algorithms','data-structures','leetcode','cheatsheet','playground','sandbox'],
};

const LANGUAGES = ['Python', 'JavaScript', 'TypeScript'];
const MIN_REPO_SCORE = 0;

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export function getActivePool(selectedCategories) {
  if (!selectedCategories || selectedCategories.size === 0)
    return Object.values(WORD_CATEGORIES).flat();
  return Object.entries(WORD_CATEGORIES)
    .filter(([cat]) => selectedCategories.has(cat))
    .flatMap(([, words]) => words);
}

// Unified scoring — matches server /score endpoint exactly
export function calcCandidateScore(issue) {
  let score = 0; const breakdown = {};

  // 1. Has PR link (25 pts)
  if (issue.prLink) { score += 25; breakdown.hasPrLink = 25; }
  else breakdown.hasPrLink = 0;

  // 2. Files changed count (up to 20 pts)
  const fc = (issue.filesChanged || []).length;
  const fcPts = fc === 0 ? 0 : fc === 1 ? 8 : fc <= 5 ? 15 : fc <= 15 ? 20 : 18;
  score += fcPts; breakdown.filesChanged = fcPts;

  // 3. Issue title quality (up to 15 pts)
  const titleLen = (issue.issueTitle || '').length;
  const titlePts = titleLen < 10 ? 0 : titleLen < 20 ? 5 : titleLen < 60 ? 15 : 10;
  score += titlePts; breakdown.titleQuality = titlePts;

  // 4. Proper GitHub issue URL (10 pts)
  if (/github\.com\/[^/]+\/[^/]+\/issues\/\d+/.test(issue.issueLink || '')) { score += 10; breakdown.isGithubIssue = 10; }
  else breakdown.isGithubIssue = 0;

  // 5. baseSha looks like a real SHA (7–40 hex chars) (10 pts)
  if (/^[0-9a-f]{7,40}$/i.test((issue.baseSha || '').trim())) { score += 10; breakdown.validBaseSha = 10; }
  else breakdown.validBaseSha = 0;

  // 6. Known language category (10 pts)
  if (['Python','JavaScript','TypeScript'].includes(issue.repoCategory || '')) { score += 10; breakdown.knownCategory = 10; }
  else breakdown.knownCategory = 0;

  // 7. Not failed (5 pts) — candidates are never failed
  score += 5; breakdown.notFailed = 5;

  // 8. Repo name is owner/repo format (5 pts)
  if (/^[^/]+\/[^/]+$/.test((issue.repoName || '').trim())) { score += 5; breakdown.validRepoName = 5; }
  else breakdown.validRepoName = 0;

  return { score: Math.min(100, Math.max(0, score)), breakdown };
}

// ── Context ───────────────────────────────────────────────────────────────────
const RandomSearchContext = createContext(null);
export function useRandomSearch() { return useContext(RandomSearchContext); }

export function RandomSearchProvider({ children }) {
  const { user } = useAuth();
  const ghToken = user?.githubToken || '';

  // Runtime state
  const [running, setRunning]         = useState(false);
  const [log, setLog]                 = useState([]);
  const [queue, setQueue]             = useState([]);        // [{uid, issue, score, breakdown}]
  const [imported, setImported]       = useState(0);
  const [approvingId, setApprovingId] = useState(null);
  const [doneSnack, setDoneSnack]     = useState('');
  const [restoredFromDB, setRestoredFromDB] = useState(false);

  // Tray
  const [trayExpanded, setTrayExpanded] = useState(false);

  // Config
  const [keyword, setKeyword]                       = useState('');
  const [limit, setLimit]                           = useState(0);
  const [selectedCategories, setSelectedCategories] = useState(new Set());
  const [showCategories, setShowCategories]         = useState(false);
  const [autoApprove, setAutoApproveState]          = useState(false);

  // Refs for use inside async loops
  const stopRef           = useRef(false);
  const sessionClearedRef = useRef(false);  // true when user explicitly stopped → DB cleared
  const queueRef          = useRef([]);
  const importedRef       = useRef(0);
  const autoApproveRef    = useRef(false);
  const logSaveTimerRef   = useRef(null);
  const pendingResumeRef  = useRef(false);
  const [sessionLoaded, setSessionLoaded] = useState(false);

  // Keep autoApproveRef in sync
  const setAutoApprove = useCallback((v) => {
    setAutoApproveState(v);
    autoApproveRef.current = v;
  }, []);
  useEffect(() => { autoApproveRef.current = autoApprove; }, [autoApprove]);

  // ── Debounced log save to DB ──────────────────────────────────────────────
  function scheduleLogSave(nextLog) {
    if (logSaveTimerRef.current) clearTimeout(logSaveTimerRef.current);
    logSaveTimerRef.current = setTimeout(() => {
      updateSession({ log: nextLog.slice(-200) }).catch(() => {});
    }, 1000);
  }

  function appendLog(msg, color = 'inherit') {
    setLog(prev => {
      const next = [...prev.slice(-400), { text: msg, color }];
      scheduleLogSave(next);
      return next;
    });
  }

  // ── Notify when done ──────────────────────────────────────────────────────
  function notifyDone() {
    const msg = `Random search stopped. ${importedRef.current} imported, ${queueRef.current.length} pending review.`;
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try { new Notification('Random Search Complete', { body: msg }); } catch {}
    } else {
      setDoneSnack(msg);
    }
  }

  // ── Auto-import or enqueue ────────────────────────────────────────────────
  function processIssues(issues) {
    if (autoApproveRef.current) {
      importIssues({ issues })
        .then(res => {
          const count = res.data.count || 0;
          if (count > 0) {
            importedRef.current += count;
            setImported(importedRef.current);
            updateSession({ imported: importedRef.current }).catch(() => {});
            appendLog(`  ✓ Auto-imported ${count} issue(s) (total: ${importedRef.current})`, 'success.main');
            window.dispatchEvent(new CustomEvent('randomSearchImported'));
          }
          const failed = res.data.failed || [];
          if (failed.length) appendLog(`  ⚠ ${failed.length} skipped (duplicate/invalid)`, 'warning.main');
        })
        .catch(e => appendLog(`  ✗ Auto-import failed: ${e.message}`, 'error.main'));
    } else {
      const items = issues.map(issue => {
        const { score, breakdown } = calcCandidateScore(issue);
        return { uid: `${issue.issueLink}_${Date.now()}_${Math.random()}`, issue, score, breakdown };
      });
      setQueue(prev => {
        const u = [...prev, ...items];
        queueRef.current = u;
        updateSession({ queueItems: u }).catch(() => {});
        return u;
      });
      appendLog(`  ✚ ${items.length} issue(s) added to Review Panel`, 'info.main');
    }
  }

  // ── Queue handlers ────────────────────────────────────────────────────────
  const handleApprove = useCallback(async (uid) => {
    const item = queueRef.current.find(i => i.uid === uid);
    if (!item) return;
    setApprovingId(uid);
    const newQueue = queueRef.current.filter(i => i.uid !== uid);
    setQueue(newQueue); queueRef.current = newQueue;
    updateSession({ queueItems: newQueue }).catch(() => {});
    try {
      const res = await importIssues({ issues: [item.issue] });
      const count = res.data.count || 0;
      if (count > 0) {
        importedRef.current += count;
        setImported(importedRef.current);
        updateSession({ imported: importedRef.current }).catch(() => {});
        appendLog(`  ✓ Approved & imported: "${item.issue.issueTitle}"`, 'success.main');
        window.dispatchEvent(new CustomEvent('randomSearchImported'));
      } else {
        const reason = res.data.failed?.[0]?.reason || 'skipped';
        appendLog(`  ⚠ Not imported: "${item.issue.issueTitle}" — ${reason}`, 'warning.main');
      }
    } catch (e) {
      appendLog(`  ✗ Import failed: ${e.message}`, 'error.main');
    } finally {
      setApprovingId(null);
    }
  }, []);

  const handleApproveAll = useCallback(async () => {
    const items = [...queueRef.current];
    if (!items.length) return;
    setQueue([]); queueRef.current = [];
    updateSession({ queueItems: [] }).catch(() => {});
    appendLog(`  ⏳ Approving all ${items.length} pending issue(s)…`, 'text.secondary');
    try {
      const res = await importIssues({ issues: items.map(i => i.issue) });
      const count = res.data.count || 0;
      if (count > 0) {
        importedRef.current += count;
        setImported(importedRef.current);
        updateSession({ imported: importedRef.current }).catch(() => {});
        appendLog(`  ✓ Bulk imported ${count} issue(s) (total: ${importedRef.current})`, 'success.main');
        window.dispatchEvent(new CustomEvent('randomSearchImported'));
      }
      const failed = res.data.failed || [];
      if (failed.length) appendLog(`  ⚠ ${failed.length} skipped`, 'warning.main');
    } catch (e) {
      appendLog(`  ✗ Bulk import failed: ${e.message}`, 'error.main');
    }
  }, []);

  const handleReject = useCallback((uid) => {
    setQueue(prev => {
      const u = prev.filter(i => i.uid !== uid);
      queueRef.current = u;
      updateSession({ queueItems: u }).catch(() => {});
      return u;
    });
  }, []);

  const handleRejectAll = useCallback(() => {
    const count = queueRef.current.length;
    setQueue([]); queueRef.current = [];
    updateSession({ queueItems: [] }).catch(() => {});
    if (count) appendLog(`  — Rejected all ${count} pending candidate(s).`, 'text.disabled');
  }, []);

  // ── Main search loop ──────────────────────────────────────────────────────
  const startSearch = useCallback(async ({ resume = false } = {}) => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    stopRef.current = false;
    sessionClearedRef.current = false;
    autoApproveRef.current = autoApprove;

    if (!resume) {
      // Fresh start: reset everything
      importedRef.current = 0;
      setImported(0);
      setLog([]);
      setQueue([]); queueRef.current = [];
      setRestoredFromDB(false);
    }
    // resume: keep existing log/queue/imported (already restored from DB)

    setRunning(true);
    setTrayExpanded(true);

    // Persist session start with current config
    updateSession({
      isRunning:          true,
      imported:           importedRef.current,
      keyword,
      autoApprove,
      selectedCategories: [...selectedCategories],
      ...(resume ? {} : { log: [], queueItems: [] }),
    }).catch(() => {});

    const limitVal = Number(limit) || 0;
    const cats = selectedCategories;
    const kw   = keyword.trim();

    while (!stopRef.current) {
      if (limitVal > 0 && queueRef.current.length >= limitVal) {
        appendLog(`  ⏸ Queue full (${limitVal} pending). Waiting for review…`, 'text.disabled');
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }

      const word  = kw || pickRandom(getActivePool(cats));
      const lang  = pickRandom(LANGUAGES);
      const query = kw ? `${kw} ${word}` : word;
      appendLog(`→ Searching "${query}" [${lang}]…`, 'text.secondary');

      try {
        const res      = await searchRepos({ keyword: query, language: lang, token: ghToken });
        const allRepos = res.data.data || [];
        const repos    = allRepos.filter(r => (r.smartScore ?? r.score ?? 0) >= MIN_REPO_SCORE);
        appendLog(
          `  Found ${repos.length} repo(s)${allRepos.length !== repos.length ? ` (${allRepos.length - repos.length} filtered out)` : ''}`,
          repos.length ? 'inherit' : 'text.disabled'
        );

        for (const repo of repos) {
          if (stopRef.current) break;
          const repoScore = repo.smartScore ?? repo.score;
          const reasons   = [];
          if (repo.stars != null)    reasons.push(`⭐${repo.stars}`);
          if (repo.language)         reasons.push(repo.language);
          if (repo.checks?.hasTests) reasons.push('has tests');
          if (repoScore != null)     reasons.push(`score ${repoScore}`);
          appendLog(`  ↳ ${repo.fullName}${reasons.length ? ' — ' + reasons.join(' · ') : ''}`, 'info.main');

          try {
            const issRes = await searchIssues({ repos: [{ fullName: repo.fullName, language: lang }], token: ghToken });
            const issues = issRes.data.data || [];
            appendLog(`    Found ${issues.length} issue(s)`, issues.length ? 'inherit' : 'text.disabled');
            if (issues.length) {
              issues.forEach(iss => {
                const issReasons = [];
                if (iss.prLink)                       issReasons.push('has PR');
                if ((iss.filesChanged||[]).length)     issReasons.push(`${iss.filesChanged.length} files changed`);
                if ((iss.issueTitle||'').length >= 20) issReasons.push('good title');
                if (issReasons.length)
                  appendLog(`      • "${iss.issueTitle?.slice(0,50) || '?'}" [${issReasons.join(', ')}]`, 'text.secondary');
              });
              processIssues(issues);
            }
          } catch (e) {
            appendLog(`    ✗ Issue search failed: ${e.message}`, 'error.main');
          }

          if (!stopRef.current) await new Promise(r => setTimeout(r, 1500));
        }
      } catch (e) {
        appendLog(`  ✗ Repo search failed: ${e.message}`, 'error.main');
      }

      if (!stopRef.current) {
        const delay = 3000 + Math.random() * 2000;
        appendLog(`  ⏳ Next search in ${(delay / 1000).toFixed(1)}s…`, 'text.disabled');
        await new Promise(r => setTimeout(r, delay));
      }
    }

    setRunning(false);
    // If stop was user-initiated, session was already cleared in stopSearch().
    // Otherwise (should not happen normally), mark isRunning: false.
    if (!sessionClearedRef.current) {
      updateSession({ isRunning: false }).catch(() => {});
    }
    notifyDone();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoApprove, ghToken, keyword, limit, selectedCategories]);

  const stopSearch = useCallback(() => {
    stopRef.current = true;
    sessionClearedRef.current = true;
    // Nuke the whole session from DB — this is the "finish" action
    clearSession().catch(() => {});
    setLog(prev => [...prev, { text: '■ Stopped by user.', color: 'warning.main' }]);
    // Also clear pending queue from UI
    setQueue([]); queueRef.current = [];
    setRestoredFromDB(false);
  }, []);

  // ── Session restore on mount ──────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    getSession()
      .then(res => {
        const s = res.data.session;
        if (s) {
          if (s.log?.length)              setLog(s.log);
          if (s.imported)               { setImported(s.imported); importedRef.current = s.imported; }
          if (s.queueItems?.length)     { setQueue(s.queueItems); queueRef.current = s.queueItems; }
          if (s.keyword)                  setKeyword(s.keyword);
          if (s.autoApprove)              setAutoApprove(s.autoApprove);
          if (s.selectedCategories?.length) setSelectedCategories(new Set(s.selectedCategories));
          const hasData = !!(s.log?.length || s.imported || s.queueItems?.length);
          if (hasData)                    setTrayExpanded(true);
          if (hasData)                    setRestoredFromDB(true);
          if (s.isRunning)                pendingResumeRef.current = true;
        }
        setSessionLoaded(true);
      })
      .catch(() => setSessionLoaded(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  // Auto-resume once session is loaded and startSearch callback is stable
  useEffect(() => {
    if (sessionLoaded && pendingResumeRef.current && !running) {
      pendingResumeRef.current = false;
      appendLog('↺ Auto-resuming search from previous session…', 'secondary.main');
      startSearch({ resume: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLoaded, startSearch]);

  const value = {
    running, log, queue, imported, approvingId, doneSnack, setDoneSnack,
    restoredFromDB,
    keyword, setKeyword,
    limit, setLimit,
    selectedCategories, setSelectedCategories,
    showCategories, setShowCategories,
    autoApprove, setAutoApprove,
    trayExpanded, setTrayExpanded,
    startSearch, stopSearch,
    handleApprove, handleApproveAll,
    handleReject, handleRejectAll,
  };

  return (
    <RandomSearchContext.Provider value={value}>
      {children}
    </RandomSearchContext.Provider>
  );
}
