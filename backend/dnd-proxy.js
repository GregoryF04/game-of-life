// Read-only, cached proxies to TTG Club data for the character builder at /character/.
//
//   /api/dnd/*    → TTG core-api, D&D 2024 rules  (https://github.com/TTG-Club/core-api)
//   /api/dnd14/*  → legacy TTG API, D&D 2014 rules (5e14.ttg.club/api/v1, POST-only)
//
// The browser only talks to these routes, so we can cache aggressively (the compendium
// changes rarely) and keep serving a stale copy if TTG is down.

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FRESH_MS = 12 * 60 * 60 * 1000;     // serve from cache without revalidating
const UPSTREAM_TIMEOUT_MS = 15_000;
const MAX_BODY_BYTES = 8 * 1024 * 1024;
const MEMORY_ENTRIES = 150;

// ---------- 2024: core-api ----------

const CORE_UPSTREAM = (process.env.TTG_API_BASE || 'https://api.ttg.club/api/v2').replace(/\/+$/, '');
const CORE_SECTIONS = 'classes|species|backgrounds|feats|spells';
const CORE_SLUG = '[a-z0-9][a-z0-9-]{0,120}';
const CORE_PATHS = [
  new RegExp(`^(${CORE_SECTIONS})/search$`),
  new RegExp(`^(${CORE_SECTIONS})/${CORE_SLUG}$`),
  new RegExp(`^classes/${CORE_SLUG}/subclasses$`),
  new RegExp(`^species/${CORE_SLUG}/lineages$`),
  /^dictionaries\/(skills|abilities|alignments|languages|sizes|damage\/types|conditions)$/,
  /^sources$/,
];
const CORE_PARAMS = new Set(['search', 'className', 'subclassName', 'level', 'category', 'ability', 'source', 'school', 'pageSize', 'page']);

function resolveCore(subPath, query) {
  if (!CORE_PATHS.some(re => re.test(subPath))) return null;
  const params = new URLSearchParams();
  Object.keys(query).sort().forEach(name => {
    if (!CORE_PARAMS.has(name)) return;
    const value = String(query[name]).slice(0, 200);
    if (value) params.set(name, value);
  });
  const qs = params.toString();
  const key = qs ? `${subPath}?${qs}` : subPath;
  // The source list is a read-only POST upstream (no body = "all sources").
  if (subPath === 'sources') return { key, url: `${CORE_UPSTREAM}/source/search`, method: 'POST' };
  return { key, url: `${CORE_UPSTREAM}/${key}`, method: 'GET' };
}

// ---------- 2014: legacy API (every endpoint is POST with a JSON body) ----------

const LEGACY_UPSTREAM = (process.env.TTG_LEGACY_API_BASE || 'https://5e14.ttg.club/api/v1').replace(/\/+$/, '');
// Legacy slugs look like "wizard", "fighter/eldritch_knight", "human/human_(variant)".
const LEGACY_SLUG = "[a-z0-9][a-z0-9_()'’.-]{0,120}";
const LEGACY_LISTS = new Set(['classes', 'races', 'backgrounds', 'traits']);
const LEGACY_DETAIL = [
  new RegExp(`^classes/${LEGACY_SLUG}(/${LEGACY_SLUG})?$`),
  new RegExp(`^races/${LEGACY_SLUG}(/${LEGACY_SLUG})?$`),
  new RegExp(`^(backgrounds|traits|spells)/${LEGACY_SLUG}$`),
];

function resolveLegacy(subPath, query) {
  const encode = p => p.split('/').map(encodeURIComponent).join('/');
  if (LEGACY_LISTS.has(subPath)) {
    return { key: subPath, url: `${LEGACY_UPSTREAM}/${subPath}`, method: 'POST', body: { page: 0, size: 2000 } };
  }
  if (subPath === 'spells') {
    // Spell list of one class, by the legacy numeric class id.
    const classId = String(query.class || '');
    if (!/^\d{1,4}$/.test(classId)) return null;
    return {
      key: `spells?class=${classId}`, url: `${LEGACY_UPSTREAM}/spells`, method: 'POST',
      body: { page: 0, size: 2000, filter: { class: [classId] } },
    };
  }
  if (LEGACY_DETAIL.some(re => re.test(subPath))) {
    return { key: subPath, url: `${LEGACY_UPSTREAM}/${encode(subPath)}`, method: 'POST', body: {} };
  }
  return null;
}

// ---------- shared cache + router ----------

function createCachedProxy({ cacheDir, resolve }) {
  const router = express.Router();
  const memory = new Map(); // key -> { body, fetchedAt }
  const inflight = new Map();

  fs.mkdir(cacheDir, { recursive: true }, () => {});

  function remember(key, entry) {
    memory.delete(key);
    memory.set(key, entry);
    while (memory.size > MEMORY_ENTRIES) memory.delete(memory.keys().next().value);
  }

  function diskFile(key) {
    return path.join(cacheDir, crypto.createHash('sha1').update(key).digest('hex') + '.json');
  }

  async function readDisk(key) {
    try {
      const raw = await fs.promises.readFile(diskFile(key), 'utf8');
      const entry = JSON.parse(raw);
      return entry && typeof entry.body === 'string' ? entry : null;
    } catch {
      return null;
    }
  }

  function writeDisk(key, entry) {
    fs.writeFile(diskFile(key), JSON.stringify({ key, ...entry }), err => {
      if (err) console.error('dnd-cache write failed:', err.message);
    });
  }

  async function fetchUpstream(req) {
    const headers = { accept: 'application/json', 'user-agent': 'mini-games-character-builder/1.0' };
    if (req.body) headers['content-type'] = 'application/json';
    const res = await fetch(req.url, {
      method: req.method,
      headers,
      body: req.body ? JSON.stringify(req.body) : undefined,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    const body = await res.text();
    if (!res.ok) {
      const err = new Error(`Upstream ${res.status}`);
      // The legacy API answers unknown slugs with 500, not 404.
      err.status = res.status === 404 || res.status === 500 ? 404 : res.status;
      throw err;
    }
    if (body.length > MAX_BODY_BYTES) throw new Error('Upstream response too large');
    JSON.parse(body); // refuse to cache non-JSON
    return { body, fetchedAt: Date.now() };
  }

  async function load(req) {
    const { key } = req;
    const entry = memory.get(key) || await readDisk(key);
    if (entry && Date.now() - entry.fetchedAt < FRESH_MS) {
      remember(key, entry);
      return { entry, cache: 'hit' };
    }
    if (!inflight.has(key)) {
      inflight.set(key, fetchUpstream(req).finally(() => inflight.delete(key)));
    }
    try {
      const fresh = await inflight.get(key);
      remember(key, fresh);
      writeDisk(key, fresh);
      return { entry: fresh, cache: 'miss' };
    } catch (err) {
      if (entry && err.status !== 404) {
        remember(key, entry);
        return { entry, cache: 'stale' };
      }
      throw err;
    }
  }

  router.get('/*', async (req, res) => {
    const upstreamReq = resolve(req.params[0] || '', req.query);
    if (!upstreamReq) return res.status(404).json({ ok: false, error: 'Unknown dnd endpoint' });

    try {
      const { entry, cache } = await load(upstreamReq);
      res.set('X-Dnd-Cache', cache);
      res.set('Cache-Control', 'public, max-age=600');
      res.type('application/json').send(entry.body);
    } catch (err) {
      const status = err.status === 404 ? 404 : 502;
      res.status(status).json({ ok: false, error: status === 404 ? 'Not found' : 'TTG Club API unavailable' });
    }
  });

  return router;
}

function createDndProxy({ cacheDir }) {
  return createCachedProxy({ cacheDir, resolve: resolveCore });
}

function createDnd14Proxy({ cacheDir }) {
  return createCachedProxy({ cacheDir, resolve: resolveLegacy });
}

module.exports = { createDndProxy, createDnd14Proxy };
