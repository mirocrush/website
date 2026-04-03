import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { searchRepos, searchIssues, importIssues } from '../api/smartSearchApi';
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
const MIN_REPO_SCORE = 50; // hardcoded, no longer exposed in UI

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export function getActivePool(selectedCategories) {
  if (!selectedCategories || selectedCategories.size === 0)
    return Object.values(WORD_CATEGORIES).flat();
  return Object.entries(WORD_CATEGORIES)
    .filter(([cat]) => selectedCategories.has(cat))
    .flatMap(([, words]) => words);
}

export function calcCandidateScore(issue) {
  let score = 0; const breakdown = {};
  if (issue.prLink)                                               { score += 25; breakdown.hasPrLink = 25; }
  const fc = Array.isArray(issue.filesChanged) ? issue.filesChanged : (issue.filesChanged ? [issue.filesChanged] : []);
  if (fc.length > 0)                                             { score += 20; breakdown.filesChanged = 20; }
  if ((issue.issueTitle || '').length > 10)                      { score += 15; breakdown.titleQuality = 15; }
  if (/\/issues\/\d+/.test(issue.issueLink || ''))               { score += 10; breakdown.isGithubIssue = 10; }
  if (/^[0-9a-f]{40}$/i.test(issue.baseSha || ''))              { score += 10; breakdown.validBaseSha = 10; }
  if (['Python','JavaScript','TypeScript'].includes(issue.repoCategory || '')) { score += 10; breakdown.knownCategory = 10; }
  score += 5; breakdown.notFailed = 5;
  if (/\w+\/\w+/.test(issue.repoName || ''))                     { score += 5;  breakdown.validRepoName = 5; }
  return { score, breakdown };
}

// ── Context ───────────────────────────────────────────────────────────────────
const RandomSearchContext = createContext(null);
export function useRandomSearch() { return useContext(RandomSearchContext); }

export function RandomSearchProvider({ children }) {
  const { user } = useAuth();
  const ghToken = user?.githubToken || '';

  // Runtime state
  const [running, setRunning]         = useState(false);
  const [log, setLog]                 = useState([]);        // [{text, color}]
  const [queue, setQueue]             = useState([]);        // [{uid, issue, score, breakdown}]
  const [imported, setImported]       = useState(0);
  const [approvingId, setApprovingId] = useState(null);
  const [doneSnack, setDoneSnack]     = useState('');        // snackbar fallback message

  // Tray
  const [trayExpanded, setTrayExpanded] = useState(false);

  // Config (persists when modal closes)
  const [keyword, setKeyword]                         = useState('');
  const [limit, setLimit]                             = useState(0);
  const [selectedCategories, setSelectedCategories]   = useState(new Set());
  const [showCategories, setShowCategories]           = useState(false);
  const [autoApprove, setAutoApproveState]            = useState(false);

  // Refs for use inside async loops
  const stopRef        = useRef(false);
  const queueRef       = useRef([]);
  const importedRef    = useRef(0);
  const autoApproveRef = useRef(false);

  // Keep autoApproveRef in sync with state
  const setAutoApprove = useCallback((v) => {
    setAutoApproveState(v);
    autoApproveRef.current = v;
  }, []);

  useEffect(() => { autoApproveRef.current = autoApprove; }, [autoApprove]);

  function appendLog(msg, color = 'inherit') {
    setLog(prev => [...prev.slice(-400), { text: msg, color }]);
  }

  // Notify when done (browser notification + snackbar fallback)
  function notifyDone() {
    const msg = `Random search stopped. ${importedRef.current} imported, ${queueRef.current.length} pending review.`;
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try { new Notification('Random Search Complete', { body: msg }); } catch {}
    } else {
      setDoneSnack(msg);
    }
  }

  // Auto-import or enqueue
  function processIssues(issues) {
    if (autoApproveRef.current) {
      importIssues({ issues })
        .then(res => {
          const count = res.data.count || 0;
          if (count > 0) {
            importedRef.current += count;
            setImported(importedRef.current);
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
      setQueue(prev => { const u = [...prev, ...items]; queueRef.current = u; return u; });
      appendLog(`  ✚ ${items.length} issue(s) added to Review Panel`, 'info.main');
    }
  }

  const handleApprove = useCallback(async (uid) => {
    const item = queueRef.current.find(i => i.uid === uid);
    if (!item) return;
    setApprovingId(uid);
    setQueue(prev => { const u = prev.filter(i => i.uid !== uid); queueRef.current = u; return u; });
    try {
      const res = await importIssues({ issues: [item.issue] });
      const count = res.data.count || 0;
      if (count > 0) {
        importedRef.current += count;
        setImported(importedRef.current);
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
    appendLog(`  ⏳ Approving all ${items.length} pending issue(s)…`, 'text.secondary');
    try {
      const res = await importIssues({ issues: items.map(i => i.issue) });
      const count = res.data.count || 0;
      if (count > 0) {
        importedRef.current += count;
        setImported(importedRef.current);
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
    setQueue(prev => { const u = prev.filter(i => i.uid !== uid); queueRef.current = u; return u; });
  }, []);

  const handleRejectAll = useCallback(() => {
    const count = queueRef.current.length;
    setQueue([]); queueRef.current = [];
    if (count) appendLog(`  — Rejected all ${count} pending candidate(s).`, 'text.disabled');
  }, []);

  const startSearch = useCallback(async () => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
    stopRef.current = false;
    autoApproveRef.current = autoApprove;
    importedRef.current = 0;
    setRunning(true);
    setLog([]);
    setImported(0);
    setQueue([]); queueRef.current = [];
    setTrayExpanded(true);

    const limitVal = Number(limit) || 0;
    const cats = selectedCategories;
    const kw = keyword.trim();

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
        const res   = await searchRepos({ keyword: query, language: lang, token: ghToken });
        const repos = (res.data.data || []).filter(r => (r.score || 0) >= MIN_REPO_SCORE);
        appendLog(`  Found ${repos.length} repo(s) with score ≥ ${MIN_REPO_SCORE}`, repos.length ? 'inherit' : 'text.disabled');

        for (const repo of repos) {
          if (stopRef.current) break;
          appendLog(`  ↳ ${repo.fullName} (score ${repo.score})`, 'info.main');
          try {
            const issRes = await searchIssues({ repos: [{ fullName: repo.fullName, language: lang }], token: ghToken });
            const issues = issRes.data.data || [];
            appendLog(`    Found ${issues.length} issue(s)`, issues.length ? 'inherit' : 'text.disabled');
            if (issues.length) processIssues(issues);
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
    notifyDone();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoApprove, ghToken, keyword, limit, selectedCategories]);

  const stopSearch = useCallback(() => {
    stopRef.current = true;
    setLog(prev => [...prev, { text: '■ Stopped by user.', color: 'warning.main' }]);
  }, []);

  const value = {
    running, log, queue, imported, approvingId, doneSnack, setDoneSnack,
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
