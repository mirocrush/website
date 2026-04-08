'use strict';

const axios = require('axios');

// ── Rate-limit cache ──────────────────────────────────────────────────────────
// Key: token string  →  { remaining, resetAt (epoch ms), checkedAt (epoch ms) }
const cache = new Map();
const CACHE_TTL_MS = 60_000; // re-check after 1 minute

function ghRateHeaders(token) {
  const h = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'SmartIssueFinder/1.0',
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function fetchRateLimit(token) {
  if (!token) return { remaining: 0, limit: 0, resetAt: 0 };

  const cached = cache.get(token);
  if (cached && Date.now() - cached.checkedAt < CACHE_TTL_MS) {
    return cached;
  }

  try {
    const r = await axios.get('https://api.github.com/rate_limit', {
      headers: ghRateHeaders(token),
      timeout: 8000,
      validateStatus: () => true,
    });
    const core = r.data?.rate || r.data?.resources?.core || {};
    const entry = {
      remaining:  core.remaining ?? 0,
      limit:      core.limit     ?? 0,
      resetAt:    (core.reset    ?? 0) * 1000,  // convert epoch seconds → ms
      checkedAt:  Date.now(),
    };
    cache.set(token, entry);
    return entry;
  } catch {
    return { remaining: 0, limit: 0, resetAt: 0 };
  }
}

/**
 * Build the ordered token pool for a user:
 *   1. All tokens in user.githubTokens (in order added)
 *   2. Legacy user.githubToken (migration fallback)
 *   3. process.env.GITHUB_TOKEN (server-level fallback)
 *
 * Returns { token, remaining, limit, resetAt } for the best available token,
 * or an empty token string if all are rate-limited / none configured.
 */
async function pickBestToken(user) {
  const pool = [];

  // Primary: array of tokens
  for (const t of user?.githubTokens || []) {
    if (t.token && !pool.includes(t.token)) pool.push(t.token);
  }
  // Legacy single token
  if (user?.githubToken && !pool.includes(user.githubToken)) {
    pool.push(user.githubToken);
  }
  // Env fallback
  const envTok = process.env.GITHUB_TOKEN;
  if (envTok && !pool.includes(envTok)) pool.push(envTok);

  if (!pool.length) return '';

  // Check rate limits for all tokens in parallel
  const usages = await Promise.all(pool.map(t => fetchRateLimit(t)));

  // Pick first token with meaningful remaining quota (>50 to be safe)
  for (let i = 0; i < pool.length; i++) {
    if (usages[i].remaining > 50) return pool[i];
  }

  // All exhausted — return the one whose reset is soonest
  let best = 0;
  for (let i = 1; i < pool.length; i++) {
    if (usages[i].resetAt < usages[best].resetAt) best = i;
  }
  return pool[best] || '';
}

/**
 * Return rate-limit info for every token in the user's pool.
 * Used by the Profile page to display usage per token.
 */
async function getTokenUsages(user) {
  const entries = [];

  for (const t of user?.githubTokens || []) {
    if (!t.token) continue;
    const usage = await fetchRateLimit(t.token);
    entries.push({
      id:        t._id?.toString(),
      label:     t.label || '',
      masked:    maskToken(t.token),
      addedAt:   t.addedAt,
      remaining: usage.remaining,
      limit:     usage.limit,
      resetAt:   usage.resetAt,
    });
  }

  // Legacy single token
  if (user?.githubToken && !(user.githubTokens || []).some(t => t.token === user.githubToken)) {
    const usage = await fetchRateLimit(user.githubToken);
    entries.push({
      id:        '__legacy__',
      label:     'Legacy token',
      masked:    maskToken(user.githubToken),
      addedAt:   null,
      remaining: usage.remaining,
      limit:     usage.limit,
      resetAt:   usage.resetAt,
    });
  }

  return entries;
}

function maskToken(token) {
  if (!token) return '';
  if (token.length <= 8) return '****';
  return token.slice(0, 4) + '…' + token.slice(-4);
}

// Invalidate cache for a specific token (e.g. after it's known to be rate-limited)
function invalidateCache(token) {
  cache.delete(token);
}

module.exports = { pickBestToken, getTokenUsages, fetchRateLimit, invalidateCache };
