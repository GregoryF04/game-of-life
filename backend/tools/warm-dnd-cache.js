#!/usr/bin/env node
// Builds a snapshot of the D&D 2014 compendium (legacy TTG API) in the proxy's disk-cache
// format, for hosts whose own connection to TTG cannot download larger responses.
//
// Run it on a machine that can reach 5e14.ttg.club, then copy the output folder to the
// server's cache directory (DATA_DIR/dnd-cache/2014), e.g.:
//
//   node backend/tools/warm-dnd-cache.js --out ./dnd14-snapshot
//   scp -r ./dnd14-snapshot/. <server>:~/gol-data/dnd-cache/2014/
//
// The proxy serves those files at once and refreshes them in the background when it can.
//
// TTG rate-limits bursts (HTTP 429), so requests go one at a time with a pause, back off on
// 429, and the run is resumable: files already in --out are reused, not fetched again.
//
// Options:
//   --out <dir>          output folder (required)
//   --all                include homebrew / playtest / third-party content (default: official books only)
//   --delay <ms>         pause between requests (default 800)
//   --no-spell-details   skip individual spell pages (lists are still saved)
//   --gzip               write .json.gz files (what backend/seed/dnd14 holds); the proxy
//                        reads both .json and .json.gz

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { resolveLegacy, requestWithRetry, cacheFileName } = require('../dnd-proxy');

function parseArgs(argv) {
  const args = { out: '', all: false, delay: 800, spellDetails: true, gzip: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') args.out = argv[++i];
    else if (argv[i] === '--all') args.all = true;
    else if (argv[i] === '--delay') args.delay = Math.max(0, Number(argv[++i]) || 0);
    else if (argv[i] === '--no-spell-details') args.spellDetails = false;
    else if (argv[i] === '--gzip') args.gzip = true;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args.out) {
  console.error('Usage: node backend/tools/warm-dnd-cache.js --out <dir> [--all] [--delay 800] [--no-spell-details]');
  process.exit(1);
}
fs.mkdirSync(args.out, { recursive: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));
// "/classes/fighter/eldritch_knight" -> "fighter/eldritch_knight"
const slug = url => String(url || '').replace(/^\/(classes|races|backgrounds|traits|feats|spells)\//, '');
// Official books are group "Basic" in the legacy data.
const wanted = item => args.all || item?.source?.group?.shortName === 'Basic';

const stats = { fetched: 0, reused: 0, skipped: 0, failed: [] };

// Existing entry in either form (plain or gzipped), or null.
function readExisting(base) {
  for (const [file, gz] of [[`${base}.gz`, true], [base, false]]) {
    if (!fs.existsSync(file)) continue;
    try {
      const raw = fs.readFileSync(file);
      return JSON.parse((gz ? zlib.gunzipSync(raw) : raw).toString('utf8'));
    } catch { /* corrupt: fetch again */ }
  }
  return null;
}

function writeEntry(base, entry) {
  const text = JSON.stringify(entry);
  if (args.gzip) {
    fs.writeFileSync(`${base}.gz`, zlib.gzipSync(text, { level: 9 }));
    if (fs.existsSync(base)) fs.unlinkSync(base); // keep one form per key
  } else {
    fs.writeFileSync(base, text);
  }
}

async function fetchKey(subPath, query = {}) {
  const req = resolveLegacy(subPath, query);
  if (!req) { stats.skipped++; return null; }
  const file = path.join(args.out, cacheFileName(req.key));
  const existing = readExisting(file);
  if (existing) {
    try {
      const json = JSON.parse(existing.body);
      if (args.gzip && !fs.existsSync(`${file}.gz`)) writeEntry(file, existing); // convert in place
      stats.reused++;
      return json;
    } catch { /* corrupt: fetch again */ }
  }
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const res = await requestWithRetry(req);
      if (res.status === 429) {
        const wait = Math.min(300, 30 * attempt) * 1000;
        console.log(`  rate limited, waiting ${wait / 1000}s…`);
        await sleep(wait);
        continue;
      }
      if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status}`);
      const json = JSON.parse(res.text);
      writeEntry(file, { key: req.key, body: res.text, fetchedAt: Date.now() });
      stats.fetched++;
      if (stats.fetched % 50 === 0) console.log(`  ${stats.fetched} fetched…`);
      await sleep(args.delay);
      return json;
    } catch (err) {
      if (attempt === 6) { stats.failed.push(`${req.key}: ${err.message}`); return null; }
      await sleep(5000);
    }
  }
  stats.failed.push(`${req.key}: still rate limited`);
  return null;
}

async function each(items, worker) {
  for (const item of items) await worker(item);
}

(async () => {
  console.log(`Scope: ${args.all ? 'all content' : 'official books only'}`);
  console.log('Lists…');
  const classes = await fetchKey('classes');
  const races = await fetchKey('races');
  const backgrounds = await fetchKey('backgrounds');
  const traits = await fetchKey('traits');
  if (!classes || !races || !backgrounds) {
    console.error('Could not load the base lists; is 5e14.ttg.club reachable from here?');
    process.exit(1);
  }

  console.log('Classes and subclasses…');
  const classIds = new Set([2]); // wizard list: Eldritch Knight / Arcane Trickster
  const optionSlugs = new Set(); // fighting styles, invocations, metamagic, maneuvers, …
  const collectOptions = detail => (detail?.traits?.features || [])
    .forEach(f => (f.options || []).forEach(o => o.url && optionSlugs.add(String(o.url).replace(/^\/options\//, ''))));
  for (const c of classes.filter(wanted)) {
    const detail = await fetchKey(`classes/${slug(c.url)}`);
    if (detail?.id) classIds.add(detail.id);
    collectOptions(detail);
    for (const a of (c.archetypes || []).filter(wanted)) collectOptions(await fetchKey(`classes/${slug(a.url)}`));
  }

  console.log(`Feature options (${optionSlugs.size})…`);
  await each([...optionSlugs], p => fetchKey(`options/${p}`));

  console.log('Races and subraces…');
  for (const r of races.filter(wanted)) {
    await fetchKey(`races/${slug(r.url)}`);
    await each((r.subraces || []).filter(wanted), s => fetchKey(`races/${slug(s.url)}`));
  }

  console.log('Backgrounds and feats…');
  await each(backgrounds.filter(wanted), b => fetchKey(`backgrounds/${slug(b.url)}`));
  await each((traits || []).filter(wanted), t => fetchKey(`traits/${slug(t.url)}`));

  console.log('Class spell lists…');
  const spells = new Map();
  for (const id of classIds) {
    const list = await fetchKey('spells', { class: String(id) });
    (list || []).filter(wanted).forEach(s => spells.set(slug(s.url), s));
  }

  if (args.spellDetails) {
    console.log(`Spell details (${spells.size})…`);
    await each([...spells.keys()], p => fetchKey(`spells/${p}`));
  }

  const files = fs.readdirSync(args.out);
  const bytes = files.reduce((sum, f) => sum + fs.statSync(path.join(args.out, f)).size, 0);
  console.log(`\nSnapshot: ${files.length} files, ${(bytes / 1048576).toFixed(1)} MB in ${args.out}`);
  console.log(`This run: ${stats.fetched} fetched, ${stats.reused} already present, ${stats.skipped} skipped (paths the proxy would not accept).`);
  if (stats.failed.length) {
    console.log(`Failed ${stats.failed.length} (re-run to retry):`);
    stats.failed.slice(0, 20).forEach(f => console.log(`  ${f}`));
  }
})();
