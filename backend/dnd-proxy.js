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
const https = require('https');
const http = require('http');
const zlib = require('zlib');

const FRESH_MS = 12 * 60 * 60 * 1000;     // serve from cache without revalidating
const ATTEMPT_TIMEOUT_MS = 10_000;
const ATTEMPTS = 3;
const MAX_BODY_BYTES = 8 * 1024 * 1024;
const MEMORY_ENTRIES = 150;

// From the production host, connections to TTG stall once a response passes roughly
// 16 KB on the wire (a network-path issue between the two hosting networks; the same
// requests work from elsewhere). So: always ask for gzip (most core-api payloads then fit),
// use a fresh connection per attempt, and retry a stalled attempt a few times.
function requestOnce({ url, method, body }) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const lib = target.protocol === 'http:' ? http : https;
    const payload = body ? JSON.stringify(body) : null;
    const headers = {
      accept: 'application/json', 'accept-encoding': 'gzip, deflate',
      'user-agent': 'mini-games-character-builder/1.0', connection: 'close',
    };
    if (payload) {
      headers['content-type'] = 'application/json';
      headers['content-length'] = Buffer.byteLength(payload);
    }
    const req = lib.request(target, { method, headers, agent: false, timeout: ATTEMPT_TIMEOUT_MS }, res => {
      const chunks = [];
      let size = 0;
      res.on('data', chunk => {
        size += chunk.length;
        if (size > MAX_BODY_BYTES) req.destroy(new Error('Upstream response too large'));
        else chunks.push(chunk);
      });
      res.on('end', () => {
        const raw = Buffer.concat(chunks);
        const encoding = String(res.headers['content-encoding'] || '').toLowerCase();
        try {
          const buf = encoding === 'gzip' ? zlib.gunzipSync(raw, { maxOutputLength: MAX_BODY_BYTES })
            : encoding === 'deflate' ? zlib.inflateSync(raw, { maxOutputLength: MAX_BODY_BYTES })
              : raw;
          resolve({ status: res.statusCode, text: buf.toString('utf8') });
        } catch (err) {
          reject(err);
        }
      });
      res.on('error', reject);
    });
    // Covers both a slow connect and a response that stops arriving mid-way.
    const deadline = setTimeout(() => req.destroy(new Error('Upstream timeout')), ATTEMPT_TIMEOUT_MS);
    req.on('timeout', () => req.destroy(new Error('Upstream timeout')));
    req.on('error', err => { clearTimeout(deadline); reject(err); });
    req.on('close', () => clearTimeout(deadline));
    if (payload) req.write(payload);
    req.end();
  });
}

async function requestWithRetry(upstreamReq) {
  let lastError;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const res = await requestOnce(upstreamReq);
      // Retry upstream hiccups, but not answers that will not change (404, bad request).
      if (res.status >= 502 && res.status <= 504 && attempt < ATTEMPTS) { lastError = new Error(`Upstream ${res.status}`); continue; }
      return res;
    } catch (err) {
      lastError = err;
      if (err.message === 'Upstream response too large') break;
    }
  }
  throw lastError;
}

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
const LEGACY_LISTS = new Set(['classes', 'races', 'backgrounds', 'traits', 'weapons', 'armors']);
const LEGACY_DETAIL = [
  new RegExp(`^classes/${LEGACY_SLUG}(/${LEGACY_SLUG})?$`),
  new RegExp(`^races/${LEGACY_SLUG}(/${LEGACY_SLUG})?$`),
  new RegExp(`^(backgrounds|traits|spells|options|weapons|armors)/${LEGACY_SLUG}$`),
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

// Cache files are named by the hash of the request key; tools/warm-dnd-cache.js writes the
// same format so a pre-built snapshot can be dropped into the cache directory.
const cacheFileName = key => crypto.createHash('sha1').update(key).digest('hex') + '.json';

// A cache entry { key, body, fetchedAt } from a .json or .json.gz file, or null.
async function readEntry(file) {
  try {
    const raw = await fs.promises.readFile(file);
    const text = file.endsWith('.gz') ? zlib.gunzipSync(raw).toString('utf8') : raw.toString('utf8');
    const entry = JSON.parse(text);
    return entry && typeof entry.body === 'string' ? entry : null;
  } catch {
    return null;
  }
}

const REFRESH_BACKOFF_MS = 60 * 60 * 1000;

// seedDir: optional read-only snapshot shipped with the app (backend/seed/...), consulted
// after the live cache. Needed for the 2014 data, which this host cannot download itself.
function createCachedProxy({ cacheDir, resolve, seedDir = null }) {
  const router = express.Router();
  const memory = new Map(); // key -> { body, fetchedAt }
  const inflight = new Map();
  const failedAt = new Map(); // key -> time of the last failed background refresh

  fs.mkdir(cacheDir, { recursive: true }, () => {});

  function remember(key, entry) {
    memory.delete(key);
    memory.set(key, entry);
    while (memory.size > MEMORY_ENTRIES) memory.delete(memory.keys().next().value);
  }

  function diskFile(key) {
    return path.join(cacheDir, cacheFileName(key));
  }

  async function readDisk(key) {
    if (!seedDir) return readEntry(diskFile(key));
    const seedFile = path.join(seedDir, cacheFileName(key));
    // The seed ships gzipped (.json.gz); plain .json also works.
    return (await readEntry(diskFile(key))) || (await readEntry(`${seedFile}.gz`)) || readEntry(seedFile);
  }

  function writeDisk(key, entry) {
    fs.writeFile(diskFile(key), JSON.stringify({ key, ...entry }), err => {
      if (err) console.error('dnd-cache write failed:', err.message);
    });
  }

  async function fetchUpstream(req) {
    const res = await requestWithRetry(req);
    if (res.status < 200 || res.status >= 300) {
      const err = new Error(`Upstream ${res.status}`);
      // The legacy API answers unknown slugs with 500, not 404.
      err.status = res.status === 404 || res.status === 500 ? 404 : res.status;
      throw err;
    }
    JSON.parse(res.text); // refuse to cache non-JSON
    return { body: res.text, fetchedAt: Date.now() };
  }

  function refresh(req) {
    const { key } = req;
    if (!inflight.has(key)) {
      const p = fetchUpstream(req).then(fresh => {
        remember(key, fresh);
        writeDisk(key, fresh);
        return fresh;
      }).finally(() => inflight.delete(key));
      inflight.set(key, p);
    }
    return inflight.get(key);
  }

  async function load(req) {
    const { key } = req;
    const entry = memory.get(key) || await readDisk(key);
    if (entry) {
      remember(key, entry);
      if (Date.now() - entry.fetchedAt < FRESH_MS) return { entry, cache: 'hit' };
      // Stale-while-revalidate: answer now, refresh in the background. Upstream can be
      // slow or unreachable from this host, and the compendium rarely changes, so after a
      // failed refresh wait an hour before trying that key again.
      if (Date.now() - (failedAt.get(key) || 0) > REFRESH_BACKOFF_MS) {
        refresh(req).then(() => failedAt.delete(key)).catch(err => {
          failedAt.set(key, Date.now());
          console.error(`dnd refresh failed for ${key}: ${err.message}`);
        });
      }
      return { entry, cache: 'stale' };
    }
    return { entry: await refresh(req), cache: 'miss' };
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

// Legacy spell lists carry no ritual/concentration flags, only the spell pages do. Build a
// compact { slug: { r, c } } index from the spell pages we already hold (seed, then the live
// cache, which may be newer).
async function buildSpellFlags(dirs) {
  const flags = {};
  for (const dir of dirs) {
    let files = [];
    try { files = await fs.promises.readdir(dir); } catch { continue; }
    for (const file of files) {
      if (!file.endsWith('.json') && !file.endsWith('.json.gz')) continue;
      try {
        const entry = await readEntry(path.join(dir, file));
        if (!entry || !/^spells\/[^?]+$/.test(entry.key || '')) continue;
        const spell = JSON.parse(entry.body);
        flags[entry.key.slice('spells/'.length)] = {
          r: spell.ritual ? 1 : 0,
          c: /концентрац/i.test(spell.duration || '') ? 1 : 0,
        };
      } catch { /* skip unreadable entries */ }
    }
  }
  return flags;
}

function createDnd14Proxy({ cacheDir, seedDir = path.join(__dirname, 'seed', 'dnd14') }) {
  const router = express.Router();
  let flags = null;
  let builtAt = 0;
  router.get('/spell-flags', async (req, res) => {
    if (!flags || Date.now() - builtAt > FRESH_MS) {
      flags = await buildSpellFlags([seedDir, cacheDir]);
      builtAt = Date.now();
    }
    res.set('Cache-Control', 'public, max-age=600');
    res.json(flags);
  });
  router.use(createCachedProxy({ cacheDir, resolve: resolveLegacy, seedDir }));
  return router;
}

module.exports = {
  createDndProxy, createDnd14Proxy,
  // for tools/warm-dnd-cache.js
  resolveCore, resolveLegacy, requestWithRetry, cacheFileName,
};
