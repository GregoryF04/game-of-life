// Read-only, cached proxy to the TTG Club core-api (https://github.com/TTG-Club/core-api).
// The character builder at /character/ talks only to /api/dnd/*; this keeps the
// browser off a third-party origin, lets us cache aggressively (the compendium
// changes rarely) and keeps the builder working from a stale copy if TTG is down.

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const UPSTREAM = (process.env.TTG_API_BASE || 'https://api.ttg.club/api/v2').replace(/\/+$/, '');
const FRESH_MS = 12 * 60 * 60 * 1000;     // serve from cache without revalidating
const UPSTREAM_TIMEOUT_MS = 15_000;
const MAX_BODY_BYTES = 8 * 1024 * 1024;
const MEMORY_ENTRIES = 150;

const SECTIONS = 'classes|species|backgrounds|feats|spells';
const SLUG = '[a-z0-9][a-z0-9-]{0,120}';
const ALLOWED_PATHS = [
  new RegExp(`^(${SECTIONS})/search$`),
  new RegExp(`^(${SECTIONS})/${SLUG}$`),
  new RegExp(`^classes/${SLUG}/subclasses$`),
  new RegExp(`^species/${SLUG}/lineages$`),
  /^dictionaries\/(skills|abilities|alignments|languages|sizes|damage\/types|conditions)$/,
  /^sources$/,
];
// Paths whose upstream endpoint differs from the proxied one. The source list is a
// read-only POST upstream (no body = "all sources").
const UPSTREAM_ROUTES = {
  sources: { path: 'source/search', method: 'POST' },
};
const ALLOWED_PARAMS = new Set(['search', 'className', 'subclassName', 'level', 'category', 'ability', 'source', 'school', 'pageSize', 'page']);

function createDndProxy({ cacheDir }) {
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

  async function fetchUpstream(key) {
    const route = UPSTREAM_ROUTES[key] || { path: key, method: 'GET' };
    const res = await fetch(`${UPSTREAM}/${route.path}`, {
      method: route.method,
      headers: { accept: 'application/json', 'user-agent': 'mini-games-character-builder/1.0' },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    const body = await res.text();
    if (!res.ok) {
      const err = new Error(`Upstream ${res.status}`);
      err.status = res.status;
      throw err;
    }
    if (body.length > MAX_BODY_BYTES) throw new Error('Upstream response too large');
    JSON.parse(body); // refuse to cache non-JSON
    return { body, fetchedAt: Date.now() };
  }

  async function load(key) {
    let entry = memory.get(key) || await readDisk(key);
    if (entry && Date.now() - entry.fetchedAt < FRESH_MS) {
      remember(key, entry);
      return { entry, cache: 'hit' };
    }
    if (!inflight.has(key)) {
      inflight.set(key, fetchUpstream(key).finally(() => inflight.delete(key)));
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
    const subPath = req.params[0] || '';
    if (!ALLOWED_PATHS.some(re => re.test(subPath))) {
      return res.status(404).json({ ok: false, error: 'Unknown dnd endpoint' });
    }

    const params = new URLSearchParams();
    Object.keys(req.query).sort().forEach(name => {
      if (!ALLOWED_PARAMS.has(name)) return;
      const value = String(req.query[name]).slice(0, 200);
      if (value) params.set(name, value);
    });
    const qs = params.toString();
    const key = qs ? `${subPath}?${qs}` : subPath;

    try {
      const { entry, cache } = await load(key);
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

module.exports = { createDndProxy };
