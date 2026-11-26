(() => {
  'use strict';

  // Compendium data comes from TTG Club through our cached proxies:
  //   2024 rules → TTG core-api (/api/dnd/), 2014 rules → legacy TTG API (/api/dnd14/).
  // Each edition keeps its own saved character, so switching never mixes datasets.
  const EDITION_KEY = 'mg-dnd-edition';
  const STORAGE_KEYS = { 2024: 'mg-dnd-character-v1', 2014: 'mg-dnd-character-2014-v1' };
  const T14 = window.TTG2014;

  const ABILITIES = [
    { key: 'STRENGTH', short: 'СИЛ', name: 'Сила', gen: 'Силы' },
    { key: 'DEXTERITY', short: 'ЛОВ', name: 'Ловкость', gen: 'Ловкости' },
    { key: 'CONSTITUTION', short: 'ТЕЛ', name: 'Телосложение', gen: 'Телосложения' },
    { key: 'INTELLIGENCE', short: 'ИНТ', name: 'Интеллект', gen: 'Интеллекта' },
    { key: 'WISDOM', short: 'МДР', name: 'Мудрость', gen: 'Мудрости' },
    { key: 'CHARISMA', short: 'ХАР', name: 'Харизма', gen: 'Харизмы' },
  ];
  const ABILITY = Object.fromEntries(ABILITIES.map(a => [a.key, a]));
  const ABILITY_BY_RUS = Object.fromEntries(ABILITIES.map(a => [a.name.toLowerCase(), a.key]));

  const FALLBACK_SKILLS = [
    ['Акробатика', 'ACROBATICS', 'DEXTERITY'], ['Анализ', 'INVESTIGATION', 'INTELLIGENCE'],
    ['Аркана', 'ARCANA', 'INTELLIGENCE'], ['Атлетика', 'ATHLETICS', 'STRENGTH'],
    ['Внимательность', 'PERCEPTION', 'WISDOM'], ['Выживание', 'SURVIVAL', 'WISDOM'],
    ['Выступление', 'PERFORMANCE', 'CHARISMA'], ['Запугивание', 'INTIMIDATION', 'CHARISMA'],
    ['История', 'HISTORY', 'INTELLIGENCE'], ['Ловкость рук', 'SLEIGHT_OF_HAND', 'DEXTERITY'],
    ['Медицина', 'MEDICINE', 'WISDOM'], ['Обман', 'DECEPTION', 'CHARISMA'],
    ['Природа', 'NATURE', 'INTELLIGENCE'], ['Проницательность', 'INSIGHT', 'WISDOM'],
    ['Религия', 'RELIGION', 'INTELLIGENCE'], ['Скрытность', 'STEALTH', 'DEXTERITY'],
    ['Убеждение', 'PERSUASION', 'CHARISMA'], ['Уход за животными', 'ANIMAL_HANDLING', 'WISDOM'],
  ].map(([label, value, ability]) => ({ label, value, ability }));

  // Default book filter. TCE and XGE are 2014 books that the TTG core-api does not carry
  // (it is 2024-rules only), so they are listed but currently match nothing.
  const DEFAULT_SOURCES = ['PHB', 'TCE', 'XGE'];
  const EXTRA_SOURCES = [
    { label: 'TCE', rus: 'Котёл Таши со всякой всячиной', group: { label: 'Basic', rus: 'Официальные источники' } },
    { label: 'XGE', rus: 'Руководство Занатара обо всём', group: { label: 'Basic', rus: 'Официальные источники' } },
  ];

  const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
  const POINT_COST = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
  const POINT_BUDGET = 27;

  // Armor from the PHB equipment table: base AC, max Dex bonus, category for proficiency.
  const ARMORS = [
    { id: 'none', name: 'Без доспехов', base: 10, maxDex: Infinity, cat: null },
    { id: 'padded', name: 'Стёганый (лёгкий)', base: 11, maxDex: Infinity, cat: 'LIGHT' },
    { id: 'leather', name: 'Кожаный (лёгкий)', base: 11, maxDex: Infinity, cat: 'LIGHT' },
    { id: 'studded', name: 'Проклёпанная кожа (лёгкий)', base: 12, maxDex: Infinity, cat: 'LIGHT' },
    { id: 'hide', name: 'Шкурный (средний)', base: 12, maxDex: 2, cat: 'MEDIUM' },
    { id: 'chain-shirt', name: 'Кольчужная рубаха (средний)', base: 13, maxDex: 2, cat: 'MEDIUM' },
    { id: 'scale', name: 'Чешуйчатый (средний)', base: 14, maxDex: 2, cat: 'MEDIUM' },
    { id: 'breastplate', name: 'Кираса (средний)', base: 14, maxDex: 2, cat: 'MEDIUM' },
    { id: 'half-plate', name: 'Полулаты (средний)', base: 15, maxDex: 2, cat: 'MEDIUM' },
    { id: 'ring', name: 'Колечный (тяжёлый)', base: 14, maxDex: 0, cat: 'HEAVY' },
    { id: 'chain-mail', name: 'Кольчуга (тяжёлый)', base: 16, maxDex: 0, cat: 'HEAVY' },
    { id: 'splint', name: 'Наборный (тяжёлый)', base: 17, maxDex: 0, cat: 'HEAVY' },
    { id: 'plate', name: 'Латы (тяжёлый)', base: 18, maxDex: 0, cat: 'HEAVY' },
  ];
  const ARMOR_CAT_NAMES = { LIGHT: 'лёгкие', MEDIUM: 'средние', HEAVY: 'тяжёлые', SHIELD: 'щиты' };

  const SENSE_NAMES = {
    DARKVISION: 'Тёмное зрение', BLINDSIGHT: 'Слепое зрение',
    TREMORSENSE: 'Чувство вибрации', TRUESIGHT: 'Истинное зрение',
  };
  const RECOVERY_NAMES = {
    LONG_REST: 'долгий отдых', SHORT_REST: 'короткий отдых',
    SHORT_REST_ONE: '1 за короткий, все за долгий отдых', DAWN: 'на рассвете',
  };
  const CASTER_NAMES = { FULL: 'полный заклинатель', HALF: 'полузаклинатель', THIRD: 'на треть заклинатель', PACT: 'магия договора' };

  // Spell slots per character level for a full caster (index = level - 1).
  const FULL_SLOTS = [
    [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2],
    [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
    [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1],
    [4, 3, 3, 3, 3, 2, 2, 1, 1],
  ];
  const PACT_SLOT_COUNT = [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4];

  // ---------- state ----------

  function defaultState() {
    return {
      version: 1,
      name: '', level: 1, alignment: '', sources: [...DEFAULT_SOURCES],
      classUrl: '', subclassUrl: '', speciesUrl: '', lineageUrl: '', backgroundUrl: '',
      abilityMethod: 'standard',
      standard: { STRENGTH: 15, DEXTERITY: 14, CONSTITUTION: 13, INTELLIGENCE: 12, WISDOM: 10, CHARISMA: 8 },
      pointbuy: Object.fromEntries(ABILITIES.map(a => [a.key, 8])),
      manual: Object.fromEntries(ABILITIES.map(a => [a.key, 10])),
      bgMode: '2-1', bgPlus2: '', bgPlus1: '',
      raceBonus: {}, // 2014: free ability picks per race bonus entry, { [entryIndex]: [ABILITY, ...] }
      extraSpells: {}, // racial/feat spell choices: { [sourceKey]: { list, picks: { [choiceKey]: [url, ...] } } }
      classSkills: [],
      feats: {},
      spells: [],
      armor: 'none', shield: false,
      classEquip: 0, bgEquip: 0,
      languages: 'Общий', notes: '',
    };
  }

  function normalizeState(raw) {
    const base = defaultState();
    if (!raw || typeof raw !== 'object') return base;
    const s = { ...base, ...raw };
    for (const k of ['standard', 'pointbuy', 'manual']) s[k] = { ...base[k], ...(raw[k] || {}) };
    s.level = clampInt(s.level, 1, 20, 1);
    if (!Array.isArray(s.classSkills)) s.classSkills = [];
    if (!Array.isArray(s.spells)) s.spells = [];
    if (!s.feats || typeof s.feats !== 'object') s.feats = {};
    if (!s.raceBonus || typeof s.raceBonus !== 'object') s.raceBonus = {};
    if (!s.extraSpells || typeof s.extraSpells !== 'object') s.extraSpells = {};
    // Older saves had a single officialOnly flag. Keep their behaviour: filter on → default
    // book set; filter off → all books ('*'), so nothing gets dropped from them on load.
    s.sources = Array.isArray(raw.sources) ? raw.sources.filter(x => typeof x === 'string')
      : raw.officialOnly ? [...DEFAULT_SOURCES] : ['*'];
    delete s.officialOnly;
    return s;
  }

  let edition = '2014';
  try { if (localStorage.getItem(EDITION_KEY) === '2024') edition = '2024'; } catch { /* storage blocked */ }

  function loadState(ed) {
    try { return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEYS[ed]))); } catch { return defaultState(); }
  }
  let state = loadState(edition);

  function save() {
    try {
      localStorage.setItem(STORAGE_KEYS[edition], JSON.stringify(state));
      localStorage.setItem(EDITION_KEY, edition);
    } catch { /* storage blocked */ }
  }

  // ---------- data ----------

  const requestCache = new Map();
  const getJson = (url, init) => fetch(url, init).then(r => {
    if (!r.ok) {
      const err = new Error(`HTTP ${r.status}`);
      err.status = r.status;
      throw err;
    }
    return r.json();
  });
  // fallback: used when our proxy cannot reach TTG (it answers 502); not for a real 404.
  function fetchJson(url, fallback) {
    if (!requestCache.has(url)) {
      const p = getJson(url).catch(err => {
        if (fallback && err.status !== 404) return fallback();
        throw err;
      });
      p.catch(() => requestCache.delete(url));
      requestCache.set(url, p);
    }
    return requestCache.get(url);
  }
  const api = path => fetchJson(P.base + path, P.direct ? () => P.direct(path) : null);

  // The core-api allows cross-origin reads, so the browser can go to TTG directly when our
  // server cannot (the server's route to TTG stalls on larger responses).
  const CORE_DIRECT = 'https://api.ttg.club/api/v2/';
  const coreDirect = path => (path === 'sources'
    ? getJson(`${CORE_DIRECT}source/search`, { method: 'POST' })
    : getJson(CORE_DIRECT + path));

  // 2014 "ability score improvement" is a choice between +2/+1+1 and a feat; we offer it
  // as a pseudo-feat so the same slot UI and bonus resolution handle both editions.
  const ASI_FEAT = {
    url: '__asi',
    name: { rus: 'Увеличение характеристик' },
    category: 'Увеличение характеристик',
    description: ['Повысьте одну характеристику на 2 или две характеристики на 1 (не выше 20).'],
    mechanics: {
      abilityBonuses: [
        { abilities: ABILITIES.map(a => a.key), bonus: 2, upto: 20, count: 1 },
        { abilities: ABILITIES.map(a => a.key), bonus: 1, upto: 20, count: 2 },
      ],
    },
  };

  // An edition provider hides each API's shape behind one interface.
  const PROVIDERS = {
    2024: {
      base: '/api/dnd/',
      direct: coreDirect,
      eyebrow: 'D&D 5e (2024) · данные TTG Club',
      labels: { species: 'Вид', lineage: 'Происхождение', noLineage: '— основной вид —', speciesPlaceholder: '— выберите вид —' },
      rules: { bgAbilityBonus: true, raceAbilityBonus: false, originFeat: true, asiPseudoFeat: false },
      async loadLists() {
        const [classes, species, backgrounds, skills, sources] = await Promise.all([
          api('classes/search'), api('species/search'), api('backgrounds/search'),
          api('dictionaries/skills').catch(() => null), api('sources').catch(() => []),
        ]);
        const sourceList = (Array.isArray(sources) ? sources : []).filter(x => x.name?.label)
          .map(x => ({ label: x.name.label, rus: x.name.rus || x.name.label, group: x.source?.group || {}, noData: false }));
        for (const extra of EXTRA_SOURCES) {
          if (!sourceList.some(x => x.label === extra.label)) sourceList.push({ ...extra, noData: true });
        }
        return {
          classes: sortByName(classes), species: sortByName(species), backgrounds: sortByName(backgrounds),
          skills: Array.isArray(skills) && skills.length ? [...skills].sort((a, b) => a.label.localeCompare(b.label, 'ru')) : FALLBACK_SKILLS,
          sourceList,
        };
      },
      loadClass: url => api(`classes/${url}`),
      subclasses: cls => api(`classes/${cls.url}/subclasses`).catch(() => []),
      loadSubclass: url => api(`classes/${url}`), // already merges the parent's features
      loadSpecies: url => api(`species/${url}`),
      lineages: short => (short?.hasLineages ? api(`species/${short.url}/lineages`).catch(() => []) : []),
      loadLineage: async (url, lineages) => lineages.find(x => x.url === url) || null,
      loadBackground: url => api(`backgrounds/${url}`),
      async featLists(needEpic) {
        const [general, epic] = await Promise.all([
          api('feats/search?category=GENERAL').catch(() => []),
          needEpic ? api('feats/search?category=EPIC_BOON').catch(() => []) : [],
        ]);
        return { general: sortByName(general), epic: sortByName(epic) };
      },
      loadFeat: url => api(`feats/${url}`),
      spellListKey({ cls, subclass, eff }) {
        if (!eff || !isCasterType(eff.casterType)) return '';
        // Subclass-only casters (Eldritch Knight, Arcane Trickster) have their own spell list on TTG.
        if (subclass && !isCasterType(cls.casterType)) return `spells/search?subclassName=${subclass.url}`;
        return `spells/search?className=${cls.url}`;
      },
      loadSpells: async key => sortByName(await api(key)),
      loadSpell: url => api(`spells/${url}`),
      // Features list granted spells; only those flagged alwaysPrepared are free (the base
      // "Spellcasting" feature lists the whole class list without the flag).
      async grantedSpells(eff, level) {
        const out = new Map();
        for (const f of eff?.features || []) {
          for (const g of f.grantedSpells || []) {
            if (!g.alwaysPrepared || !g.spell?.url) continue;
            const required = g.requiredLevel || f.level || 1;
            if (required > level || out.has(g.spell.url)) continue;
            out.set(g.spell.url, { spell: g.spell, level: required, mode: 'always', from: f.name });
          }
        }
        return [...out.values()];
      },
      // Racial spells come as innateSpells; feats as grantedSpells plus structured choices.
      spellSources({ species, lineage, feats, pb, background }) {
        const sources = [];
        for (const [key, race] of [['species', species], ['lineage', lineage]]) {
          if (!race?.innateSpells?.length) continue;
          sources.push({
            key, title: rus(race), tag: 'раса', choices: [], listOptions: null,
            fixed: race.innateSpells.filter(g => g.spell?.url).map(g => ({ url: g.spell.url, spell: g.spell, level: g.requiredLevel || 1 })),
          });
        }
        for (const { slot, feat } of feats) {
          const choices = [];
          let listOptions = null;
          for (const ch of feat.mechanics?.choices || []) {
            if (ch.type === 'SPELL_LIST') listOptions = (ch.options || []).map(o => ({ value: o.value, label: o.name }));
            if (ch.type !== 'CANTRIP' && ch.type !== 'SPELL') continue;
            const label = ch.label || '';
            choices.push({
              key: ch.key, label,
              count: ch.countEqualsProficiencyBonus ? pb : (ch.count || 1),
              level: ch.spellFilter?.level ?? (ch.type === 'CANTRIP' ? 0 : 1),
              list: ch.spellFilter?.classesFromChoiceKey ? 'choice' : 'any',
              schools: schoolsFromText(label), ritual: /ритуал/i.test(label),
            });
          }
          const fixed = (feat.grantedSpells || []).filter(g => g.spell?.url).map(g => ({ url: g.spell.url, spell: g.spell, level: slot.level }));
          if (!fixed.length && !choices.length) continue;
          // A background's Magic Initiate names its list: "… (Волшебник)".
          const defaultList = slot.key === 'origin' && listOptions
            ? listOptions.find(o => (background?.feat || '').includes(`(${o.label})`))?.value || '' : '';
          sources.push({ key: `feat:${slot.key}`, title: rus(feat), tag: 'черта', fixed, choices, listOptions, defaultList });
        }
        return sources;
      },
      async loadCandidates(ref, level) {
        const key = ref === 'any' ? `spells/search?level=${level}` : `spells/search?className=${ref}&level=${level}`;
        return sortByName(await api(key));
      },
    },
    2014: {
      base: '/api/dnd14/',
      eyebrow: 'D&D 5e (2014) · данные TTG Club (5e14)',
      labels: { species: 'Раса', lineage: 'Подраса', noLineage: '— без подрасы —', speciesPlaceholder: '— выберите расу —' },
      rules: { bgAbilityBonus: false, raceAbilityBonus: true, originFeat: false, asiPseudoFeat: true },
      async loadLists() {
        const [classes, races, backgrounds, feats] = await Promise.all([
          api('classes'), api('races'), api('backgrounds'), api('traits').catch(() => []),
        ]);
        const out = {
          classes: sortByName(classes.map(T14.normalizeClassShort)),
          species: sortByName(races.map(T14.normalizeRaceShort)),
          backgrounds: sortByName(backgrounds.map(T14.normalizeBackgroundShort)),
          feats: sortByName((Array.isArray(feats) ? feats : []).map(T14.normalizeFeatShort)),
          skills: T14.SKILLS,
        };
        // The legacy API has no source list; collect every book its content refers to.
        const seen = new Map();
        const add = item => {
          const label = item?.source?.name?.label;
          if (label && !seen.has(label)) seen.set(label, { label, rus: item.source.name.rus || label, group: item.source.group || {}, noData: false });
        };
        out.classes.forEach(c => { add(c); c.archetypes.forEach(add); });
        out.species.forEach(r => { add(r); r.subraces.forEach(add); });
        out.backgrounds.forEach(add);
        out.feats.forEach(add);
        out.sourceList = [...seen.values()];
        return out;
      },
      async loadClass(url) { return T14.normalizeClass(await api(`classes/${url}`), null, url); },
      subclasses: async cls => lists.classes.find(c => c.url === cls.url)?.archetypes || [],
      async loadSubclass(url) {
        const parentUrl = url.split('/')[0];
        const [detail, parent] = await Promise.all([api(`classes/${url}`), api(`classes/${parentUrl}`)]);
        return T14.normalizeClass(detail, parent, url);
      },
      async loadSpecies(url) { return T14.normalizeRace(await api(`races/${url}`), url); },
      lineages: async short => short?.subraces || [],
      async loadLineage(url) { return T14.normalizeRace(await api(`races/${url}`), url); },
      async loadBackground(url) { return T14.normalizeBackground(await api(`backgrounds/${url}`)); },
      featLists: async () => ({ general: lists.feats || [], epic: [] }),
      async loadFeat(url) { return T14.normalizeFeat(await api(`traits/${url}`), url); },
      spellListKey({ eff }) {
        if (!eff || !isCasterType(eff.casterType) || !eff.spellListClassId) return '';
        return `spells?class=${eff.spellListClassId}`;
      },
      loadSpells: async key => sortByName((await api(key)).map(T14.normalizeSpellShort)),
      async loadSpell(url) { return T14.normalizeSpell(await api(`spells/${url}`)); },
      // Subclass spell table: rows by class level, always prepared. The warlock table lists
      // spells by spell level and only widens the choice, so all rows apply.
      async grantedSpells(eff, level) {
        const mode = eff?.expandedList ? 'expanded' : 'always';
        const rows = (eff?.subclassSpells || []).filter(row => mode === 'expanded' || row.level <= level);
        const items = rows.flatMap(row => row.spells.map(s => ({ ...s, level: row.level })));
        const resolved = await Promise.all(items.map(async item => {
          const spell = data.spells.find(x => x.url === item.url)
            || await PROVIDERS[2014].loadSpell(item.url).catch(() => null);
          return spell ? { spell, level: item.level, mode, from: rus(eff) } : null;
        }));
        const out = new Map();
        for (const g of resolved) if (g && !out.has(g.spell.url)) out.set(g.spell.url, g);
        return [...out.values()];
      },
      // The legacy API has no structured racial/feat spells; see TTG2014.SPELL_GRANTS.
      spellSources({ species, lineage, feats }) {
        const table = T14.SPELL_GRANTS;
        const sources = [];
        const fromEntry = (key, title, tag, entry) => {
          if (!entry) return;
          sources.push({
            key, title, tag,
            fixed: (entry.fixed || []).map(([url, level]) => ({ url, level })),
            choices: (entry.choices || []).map(ch => ({ ...ch, schools: ch.schools || [], ritual: false })),
            listOptions: entry.listOptions ? entry.listOptions.map(v => ({ value: v, label: T14.CLASS_NAMES[v] || v })) : null,
            defaultList: '',
          });
        };
        const raceEntry = species && table.races[species.url];
        const lineageEntry = lineage && table.races[lineage.url];
        // Subraces that change the racial spells (tiefling variants) replace the base entry.
        if (raceEntry && !(lineage && raceEntry.replacedBySubrace)) fromEntry('species', rus(species), 'раса', raceEntry);
        if (lineageEntry) fromEntry('lineage', rus(lineage), 'раса', lineageEntry);
        for (const { slot, feat } of feats) fromEntry(`feat:${slot.key}`, rus(feat), 'черта', table.feats[feat.url]);
        return sources;
      },
      async loadCandidates(ref, level) {
        const ids = ref === 'any' ? Object.values(T14.CLASS_IDS) : [T14.CLASS_IDS[ref]].filter(Boolean);
        const lists14 = await Promise.all(ids.map(id => api(`spells?class=${id}`).catch(() => [])));
        const byUrl = new Map();
        for (const s of lists14.flat().map(T14.normalizeSpellShort)) if (s.level === level && !byUrl.has(s.url)) byUrl.set(s.url, s);
        return sortByName([...byUrl.values()]);
      },
    },
  };
  let P = PROVIDERS[edition];

  const lists = { sources: [], sourceList: [], classes: [], species: [], backgrounds: [], feats: [], skills: FALLBACK_SKILLS, damage: {}, conditions: {} };
  const data = {
    cls: null, subclasses: [], subclass: null, eff: null,
    species: null, lineages: [], lineage: null,
    background: null, feats: {}, featLists: { general: [], epic: [] },
    spells: [], spellsKey: '', granted: [], spellSources: [], spellCandidates: {},
  };

  async function loadData() {
    const s = state;
    const speciesShort = lists.species.find(x => x.url === s.speciesUrl);
    const [cls, species, lineages, background] = await Promise.all([
      s.classUrl ? P.loadClass(s.classUrl) : null,
      s.speciesUrl ? P.loadSpecies(s.speciesUrl) : null,
      speciesShort ? P.lineages(speciesShort) : [],
      s.backgroundUrl ? P.loadBackground(s.backgroundUrl) : null,
    ]);
    const subclasses = cls ? await P.subclasses(cls) : [];
    data.cls = cls;
    data.subclasses = Array.isArray(subclasses) ? subclasses : [];
    data.species = species;
    data.lineages = Array.isArray(lineages) ? lineages : [];
    data.lineage = s.lineageUrl && data.lineages.some(x => x.url === s.lineageUrl)
      ? await P.loadLineage(s.lineageUrl, data.lineages) : null;
    data.background = background;

    const subclassOpen = cls && s.subclassUrl && s.level >= (cls.subclassLevel || 3)
      && data.subclasses.some(x => x.url === s.subclassUrl);
    data.subclass = subclassOpen ? await P.loadSubclass(s.subclassUrl) : null;
    // Subclass detail already merges the parent's features and carries its own casting table.
    data.eff = data.subclass || cls;

    const slots = featSlots();
    const featUrls = [...new Set(slots.map(slot => slotFeatUrl(slot)).filter(url => url && url !== ASI_FEAT.url))];
    const needLists = slots.some(x => !x.fixed);
    const [featLists, ...featDetails] = await Promise.all([
      needLists ? P.featLists(slots.some(x => x.epic)) : { general: [], epic: [] },
      ...featUrls.map(url => P.loadFeat(url).catch(() => null)),
    ]);
    data.featLists = featLists;
    data.feats = { [ASI_FEAT.url]: ASI_FEAT };
    featUrls.forEach((url, i) => { if (featDetails[i]) data.feats[url] = featDetails[i]; });

    const spellKey = P.spellListKey(data);
    if (spellKey !== data.spellsKey) {
      data.spells = spellKey ? await P.loadSpells(spellKey) : [];
      data.spellsKey = spellKey;
    }
    data.granted = spellKey ? await P.grantedSpells(data.eff, s.level).catch(() => []) : [];
    await loadSpellSources(slots);
  }

  // Racial and feat spells: fixed grants plus choices from a class list.
  async function loadSpellSources(slots) {
    const feats = slots.map(slot => ({ slot, feat: data.feats[slotFeatUrl(slot)] }))
      .filter(x => x.feat && x.feat.url !== ASI_FEAT.url);
    const pb = 2 + Math.floor((state.level - 1) / 4);
    const sources = P.spellSources({ species: data.species, lineage: data.lineage, feats, pb, background: data.background });
    await Promise.all(sources.flatMap(src => src.fixed.filter(f => !f.spell).map(async f => {
      f.spell = await P.loadSpell(f.url).catch(() => null);
    })));
    const candidates = {};
    await Promise.all(sources.flatMap(src => src.choices.map(async ch => {
      const ref = sourceListRef(src, ch);
      const list = ref ? await P.loadCandidates(ref, ch.level).catch(() => []) : [];
      candidates[`${src.key}:${ch.key}`] = list.filter(x => x.level === ch.level
        && (!ch.schools.length || ch.schools.includes(x.school))
        && (!ch.ritual || x.ritual));
    })));
    data.spellSources = sources;
    data.spellCandidates = candidates;
  }

  function sourceListRef(src, ch) {
    if (ch.list !== 'choice') return ch.list;
    return state.extraSpells[src.key]?.list || src.defaultList || '';
  }

  const SCHOOL_STEMS = [
    ['прорицан', 'Прорицание'], ['очарован', 'Очарование'], ['иллюзи', 'Иллюзия'], ['некромант', 'Некромантия'],
    ['воплощен', 'Воплощение'], ['вызов', 'Вызов'], ['огражден', 'Ограждение'], ['преобразован', 'Преобразование'],
  ];
  // "Заклинание 1 круга школы прорицания или очарования" -> ['Прорицание', 'Очарование']
  function schoolsFromText(text) {
    const t = String(text || '').toLowerCase();
    return SCHOOL_STEMS.filter(([stem]) => t.includes(stem)).map(([, school]) => school);
  }

  // Racial/feat spells currently granted: fixed ones up to the character level plus valid picks.
  function extraSpellsNow() {
    const out = new Map();
    for (const src of data.spellSources || []) {
      for (const f of src.fixed) {
        if (f.spell && f.level <= state.level && !out.has(f.spell.url)) {
          out.set(f.spell.url, { ...f.spell, alwaysFrom: src.title, sourceTag: src.tag, grantedAt: f.level });
        }
      }
      for (const ch of src.choices) {
        const cands = data.spellCandidates?.[`${src.key}:${ch.key}`] || [];
        const picked = [];
        for (const url of state.extraSpells[src.key]?.picks?.[ch.key] || []) {
          const spell = cands.find(x => x.url === url);
          if (!spell || picked.includes(url) || picked.length >= ch.count) continue;
          picked.push(url);
          if (!out.has(url)) out.set(url, { ...spell, alwaysFrom: src.title, sourceTag: src.tag });
        }
      }
    }
    return [...out.values()];
  }

  // Spells the player can pick: the class list plus a warlock's expanded patron list.
  function spellPool() {
    const extra = (data.granted || []).filter(g => g.mode === 'expanded' && !data.spells.some(x => x.url === g.spell.url))
      .map(g => ({ ...g.spell, expanded: true }));
    return extra.length ? sortByName([...data.spells, ...extra]) : data.spells;
  }
  const alwaysPrepared = () => (data.granted || []).filter(g => g.mode === 'always');

  // ---------- helpers ----------

  function clampInt(value, min, max, fallback) {
    const n = Math.round(Number(value));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  }
  const mod = score => Math.floor((score - 10) / 2);
  const signed = n => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`);
  const isCasterType = t => Boolean(t) && t !== 'NONE';
  const rus = x => (x && x.name && (x.name.rus || x.name.eng)) || x?.url || '';
  const sortByName = arr => (Array.isArray(arr) ? [...arr].sort((a, b) => rus(a).localeCompare(rus(b), 'ru')) : []);
  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }
  function parseAbilityList(text) {
    if (!text) return [];
    return String(text).split(/[,;]|\sили\s/).map(x => ABILITY_BY_RUS[x.trim().toLowerCase()]).filter(Boolean);
  }
  function skillByLabel(label) {
    const l = label.trim().toLowerCase();
    return lists.skills.find(x => x.label.toLowerCase() === l);
  }
  function scalingValue(column, level) {
    let value = null;
    for (const step of column?.scaling || []) if (step.level <= level) value = step.value;
    return value;
  }
  function tableColumn(eff, purpose) {
    return (eff?.table || []).find(t => t.purpose === purpose) || null;
  }
  // A feature's later improvements (e.g. ASI at 8/12/16) come as scaling entries of the same feature.
  function expandFeatures(features) {
    const out = [];
    for (const f of features || []) {
      out.push(f);
      for (const step of f.scaling || []) {
        if (!step || !step.level) continue;
        out.push({
          ...f, ...step, key: `${f.key || f.name}-${step.level}`, scaling: [], mechanics: null,
          description: step.description || f.description, name: step.name || f.name,
        });
      }
    }
    return out.sort((a, b) => a.level - b.level);
  }
  // TTG groups sources as Basic (official), UA (playtest), 3rd (third-party) and, on the
  // legacy site, HB (homebrew). The book list comes from the current edition's provider.
  const knownSources = () => lists.sourceList;
  // '*' means "every book", including ones the API adds later.
  const allSourcesSelected = () => state.sources.includes('*')
    || knownSources().every(src => state.sources.includes(src.label));
  const sourceTicked = label => state.sources.includes('*') || state.sources.includes(label);
  // Items from a ticked book pass; anything else (unknown book, no label) only when every book is ticked.
  const isAllowed = item => state.sources.includes(item?.source?.name?.label) || allSourcesSelected();
  const sourcesKey = () => state.sources.slice().sort().join(',');
  const GROUP_ORDER = { Basic: 0, UA: 1, '3rd': 2, HB: 3 };
  const groupRank = item => GROUP_ORDER[item?.source?.group?.label] ?? 3;
  function featUrlFromMarkup(text) {
    const m = /url:([a-z0-9-]+)/.exec(text || '');
    return m ? m[1] : '';
  }

  // ---------- rich text (TTG markup: {@b ...}, {@glossary text|url:...}, list nodes) ----------

  function inline(str) {
    let out = esc(str);
    const re = /\{@(\w+)(?:\s+([^{}]*?))?\s*\}/g;
    for (let i = 0; i < 8; i++) {
      const next = out.replace(re, (_, tag, body = '') => {
        const text = body.split('|')[0].trim().replace(/\s*\[[^\]]*\]\s*$/, '');
        switch (tag) {
          case 'br': return '<br>';
          case 'b': return `<strong>${body}</strong>`;
          case 'i': return `<em>${body}</em>`;
          case 'dice': return `<span class="dice">${text}</span>`;
          // Legacy (2014) markup
          case 'h': return `<strong>${text}</strong>`;
          case 'list': return `<span class="mdList">${body}</span>`;
          case 'li': return `<span class="mdItem">${body}</span>`;
          case 'quote': return `<em>${body}</em>`;
          case 'p': return body.split('|')[0];
          case 'roll': { const m = /text:\s*([^|]*)/.exec(body); return `<span class="dice">${(m ? m[1] : text).trim()}</span>`; }
          case 'table': return `<span class="mdTable">${body}</span>`;
          case 'tr': return `<span class="mdRow">${body}</span>`;
          case 'td': case 'th': return `<span class="mdCell">${text}</span>`;
          case 'spell': case 'feat': case 'item': case 'creature': case 'magicItem':
            return `<span class="ref">${text}</span>`;
          default: return text;
        }
      });
      if (next === out) break;
      out = next;
    }
    return out;
  }
  function inlineNode(n) {
    let t = inline(n.text || '');
    for (const m of n.marks || []) {
      if (m.type === 'bold') t = `<strong>${t}</strong>`;
      if (m.type === 'italic') t = `<em>${t}</em>`;
    }
    return t;
  }
  function inlineAny(x) {
    if (typeof x === 'string') return inline(x);
    if (Array.isArray(x)) return x.map(inlineAny).join(' ');
    if (x && x.type === 'text') return inlineNode(x);
    return block(x);
  }
  function block(n) {
    if (n == null) return '';
    if (typeof n === 'string') return `<p>${inline(n)}</p>`;
    if (Array.isArray(n)) return n.map(block).join('');
    switch (n.type) {
      case 'list': return `<ul>${(n.content || []).map(item => `<li>${inlineAny(Array.isArray(item) ? item : (item.content || item.text || ''))}</li>`).join('')}</ul>`;
      case 'li': return `<li>${inlineAny(n.content || '')}</li>`;
      case 'text': return `<p>${inlineNode(n)}</p>`;
      case 'image': return '';
      case 'table': {
        const rows = n.rows || n.content || [];
        if (!Array.isArray(rows)) return '';
        const head = (n.colLabels || n.headers || []).map(h => `<th>${inlineAny(h)}</th>`).join('');
        return `<table>${head ? `<tr>${head}</tr>` : ''}${rows.map(r => `<tr>${(Array.isArray(r) ? r : (r.content || [])).map(c => `<td>${inlineAny(c)}</td>`).join('')}</tr>`).join('')}</table>`;
      }
      default:
        if (n.content) return block(n.content);
        if (n.text) return `<p>${inline(n.text)}</p>`;
        return '';
    }
  }
  const rich = content => `<div class="rich">${block(content)}</div>`;

  // ---------- rules ----------

  function featSlots() {
    const slots = [];
    // 2014: a race trait named «Черта» (variant human) grants a free feat at level 1.
    if (data.lineage?.grantsFeat || data.species?.grantsFeat) {
      slots.push({ key: 'race', level: 1, title: `Черта расы (${rus(data.lineage || data.species)})` });
    }
    if (P.rules.originFeat && state.backgroundUrl) {
      const short = lists.backgrounds.find(b => b.url === state.backgroundUrl);
      const fixed = short?.featUrl || featUrlFromMarkup(data.background?.feat);
      if (fixed) slots.push({ key: 'origin', level: 1, title: 'Черта предыстории', fixed });
    }
    const seen = new Set();
    for (const f of expandFeatures(data.eff?.features)) {
      if (f.level > state.level) continue;
      const epic = /эпическ\S* черт/i.test(f.name || '');
      if (!f.abilityImprovement && !epic) continue;
      let key = `lvl${f.level}`;
      while (seen.has(key)) key += 'b';
      seen.add(key);
      // 2014: the slot is "ASI or a feat" and defaults to the ASI.
      slots.push({ key, level: f.level, title: `${f.name} · ${f.level} ур.`, epic, asi: P.rules.asiPseudoFeat });
    }
    return slots;
  }
  function slotFeatUrl(slot) {
    if (slot.fixed) return slot.fixed;
    const picked = state.feats[slot.key];
    if (picked && typeof picked.url === 'string' && (picked.url || !slot.asi)) return picked.url;
    return slot.asi ? ASI_FEAT.url : '';
  }

  // 2014 race ability bonuses: cumulative entries; an entry with more candidates than its
  // count is a free choice the player makes ({ abilities, bonus, count }).
  function raceBonusPlan() {
    const race = data.lineage || data.species;
    if (!P.rules.raceAbilityBonus || !race?.abilityBonuses) return [];
    return race.abilityBonuses.map((entry, index) => {
      const candidates = entry.abilities || [];
      const count = entry.count || 1;
      let chosen;
      if (candidates.length <= count) chosen = [...candidates];
      else {
        chosen = [];
        for (const a of state.raceBonus[index] || []) {
          if (candidates.includes(a) && !chosen.includes(a) && chosen.length < count) chosen.push(a);
        }
      }
      return { index, candidates, count, bonus: entry.bonus, chosen, free: candidates.length > count };
    });
  }

  function baseScores() {
    const src = state.abilityMethod === 'pointbuy' ? state.pointbuy
      : state.abilityMethod === 'manual' ? state.manual : state.standard;
    const min = state.abilityMethod === 'manual' ? 1 : 8;
    const max = state.abilityMethod === 'manual' ? 30 : 15;
    return Object.fromEntries(ABILITIES.map(a => [a.key, clampInt(src[a.key], min, max, 10)]));
  }

  function backgroundAbilities() {
    const list = parseAbilityList(data.background?.abilityScores);
    return list.length ? list : ABILITIES.map(a => a.key);
  }

  // Resolve the ability picks of one feat slot against the feat's abilityBonuses.
  // Several abilityBonuses entries are alternatives (ASI: +2 to one OR +1 to two).
  function featBonusPlan(slot) {
    const url = slotFeatUrl(slot);
    const feat = url ? data.feats[url] : null;
    const options = feat?.mechanics?.abilityBonuses || [];
    if (!options.length) return null;
    const pick = state.feats[slot.key] || {};
    const optionIndex = clampInt(pick.option, 0, options.length - 1, 0);
    const option = options[optionIndex];
    const candidates = option.abilities || [];
    const count = option.count || 1;
    let chosen;
    if (candidates.length <= count) chosen = [...candidates];
    else {
      chosen = [];
      for (const a of pick.picks || []) {
        if (candidates.includes(a) && !chosen.includes(a) && chosen.length < count) chosen.push(a);
      }
    }
    return { feat, options, optionIndex, option, candidates, count, chosen };
  }

  function compute() {
    const s = state;
    const L = s.level;
    const { cls, eff, species, lineage, background } = data;
    const pb = 2 + Math.floor((L - 1) / 4);

    // Ability scores: base + background + feats (capped by each bonus's "upto").
    const base = baseScores();
    const scores = { ...base };
    const sources = Object.fromEntries(ABILITIES.map(a => [a.key, []]));
    const bgAbils = backgroundAbilities();
    const racePlan = raceBonusPlan();
    for (const entry of racePlan) {
      for (const k of entry.chosen) { scores[k] += entry.bonus; sources[k].push(`${signed(entry.bonus)} раса`); }
    }
    if (P.rules.bgAbilityBonus && background) {
      if (s.bgMode === '1-1-1') {
        bgAbils.slice(0, 3).forEach(k => { scores[k] += 1; sources[k].push('+1 предыстория'); });
      } else {
        if (bgAbils.includes(s.bgPlus2)) { scores[s.bgPlus2] += 2; sources[s.bgPlus2].push('+2 предыстория'); }
        if (bgAbils.includes(s.bgPlus1) && s.bgPlus1 !== s.bgPlus2) { scores[s.bgPlus1] += 1; sources[s.bgPlus1].push('+1 предыстория'); }
      }
    }
    const slots = featSlots();
    for (const slot of slots) {
      const plan = featBonusPlan(slot);
      if (!plan) continue;
      for (const k of plan.chosen) {
        const before = scores[k];
        scores[k] = Math.max(before, Math.min(plan.option.upto || 20, before + plan.option.bonus));
        if (scores[k] > before) sources[k].push(`+${scores[k] - before} ${rus(plan.feat)}`);
      }
    }
    const mods = Object.fromEntries(ABILITIES.map(a => [a.key, mod(scores[a.key])]));

    // Structured mechanics from class/subclass features, species traits and feats.
    const mech = {
      hp: 0, senses: {}, resist: new Set(), immune: new Set(), vuln: new Set(), condImm: new Set(),
      initPB: false, initBonus: 0, passiveBonus: 0, skills: new Set(), saves: new Set(), counters: [],
    };
    const addMech = (m, acquired, from) => {
      if (!m) return;
      const mo = m.modifiers || {};
      if (mo.hitPoints && (mo.hitPoints.perAcquisitionLevel || mo.hitPoints.perLevelAfterAcquisition)) {
        // "perAcquisitionLevel" is per character level at the moment the trait is gained
        // (Tough at level 4 gives +8 at once), then "perLevelAfterAcquisition" for each later level.
        const gained = Math.min(acquired, L);
        mech.hp += (mo.hitPoints.perAcquisitionLevel || 0) * gained + (mo.hitPoints.perLevelAfterAcquisition || 0) * Math.max(0, L - gained);
      }
      for (const sense of mo.senses || []) {
        if (sense?.type) mech.senses[sense.type] = Math.max(mech.senses[sense.type] || 0, sense.range || 0);
      }
      (mo.damage?.resistances || []).forEach(x => mech.resist.add(x));
      (mo.damage?.immunities || []).forEach(x => mech.immune.add(x));
      (mo.damage?.vulnerabilities || []).forEach(x => mech.vuln.add(x));
      (mo.conditionImmunities || []).forEach(x => mech.condImm.add(typeof x === 'string' ? x : x?.type));
      if (mo.initiativeProficiencyBonus) mech.initPB = true;
      mech.initBonus += Number(mo.initiativeBonus) || 0;
      mech.passiveBonus += Number(mo.passivePerceptionBonus) || 0;
      const prof = m.proficiencies || {};
      (prof.skills || []).forEach(x => typeof x === 'string' && mech.skills.add(x));
      (prof.savingThrows || []).forEach(x => typeof x === 'string' && mech.saves.add(x));
      (m.counters || []).forEach(c => mech.counters.push({ ...c, from }));
    };

    const subclassApplied = Boolean(data.subclass);
    const classFeatures = expandFeatures(eff?.features)
      .filter(f => f.level <= L && !(subclassApplied && f.hideInSubclasses));
    if (eff) addMech(eff.mechanics, 1, rus(eff));
    classFeatures.forEach(f => addMech(f.mechanics, f.level, f.name));
    const speciesFeatures = [...(species?.features || []), ...(lineage?.features || [])]
      .filter(f => (f.level || 1) <= L);
    speciesFeatures.forEach(f => addMech(f.mechanics, f.level || 1, rus(f)));
    // 2014 races keep senses / HP bonuses on the race itself rather than on a trait.
    addMech(species?.mechanics, 1, rus(species));
    addMech(lineage?.mechanics, 1, rus(lineage));
    const feats = [];
    for (const slot of slots) {
      const url = slotFeatUrl(slot);
      const feat = url ? data.feats[url] : null;
      if (!feat) continue;
      feats.push({ slot, feat });
      addMech(feat.mechanics, slot.level, rus(feat));
    }
    const props = { ...(species?.properties || {}), ...(lineage?.properties || {}) };
    if (props.darkVision > 0) mech.senses.DARKVISION = Math.max(mech.senses.DARKVISION || 0, props.darkVision);

    // Proficiencies
    const saves = new Set([...(cls?.savingThrowAbilities || []), ...mech.saves]);
    const skillData = cls?.proficiency?.skillData;
    const bgSkillText = background?.skillProficiencies || '';
    const bgSkills = background?.skillValues
      || bgSkillText.split(/,\s*/).map(skillByLabel).filter(Boolean).map(x => x.value);
    const classSkills = (s.classSkills || [])
      .filter(x => skillData?.skills?.includes(x) && !bgSkills.includes(x))
      .slice(0, skillData?.count || 0);
    const skills = new Set([...bgSkills, ...classSkills, ...mech.skills]);

    // Hit points
    const hd = eff?.hitDice || cls?.hitDice;
    let hp = 0;
    if (hd) {
      hp = Math.max(1, hd.maxValue + mods.CONSTITUTION);
      for (let lvl = 2; lvl <= L; lvl++) hp += Math.max(1, hd.avg + mods.CONSTITUTION);
      hp += mech.hp;
    }

    // Armor class
    const armor = ARMORS.find(a => a.id === s.armor) || ARMORS[0];
    const armorCats = cls?.proficiency?.armorData?.category || [];
    let ac;
    let acNote = armor.id === 'none' ? 'без доспехов' : armor.name.replace(/\s*\(.*\)/, '');
    const hasUnarmoredDefense = classFeatures.some(f => /защита без доспехов/i.test(f.name || ''));
    const hasDraconicResilience = classFeatures.some(f => /драконья устойчивость/i.test(f.name || ''));
    if (armor.id === 'none') {
      ac = 10 + mods.DEXTERITY;
      if (hasDraconicResilience) { ac = 13 + mods.DEXTERITY; acNote = 'драконья устойчивость'; }
      if (hasUnarmoredDefense && cls?.url?.startsWith('barbarian')) { ac += mods.CONSTITUTION; acNote = 'защита без доспехов'; }
      if (hasUnarmoredDefense && cls?.url?.startsWith('monk') && !s.shield) { ac += mods.WISDOM; acNote = 'защита без доспехов'; }
    } else {
      ac = armor.base + Math.min(mods.DEXTERITY, armor.maxDex);
    }
    if (s.shield) { ac += 2; acNote += ' + щит'; }
    const warnings = [];
    if (armor.cat && cls && !armorCats.includes(armor.cat)) warnings.push(`Нет владения доспехами: ${ARMOR_CAT_NAMES[armor.cat]}`);
    if (s.shield && cls && !armorCats.includes('SHIELD')) warnings.push('Нет владения щитами');

    // Spellcasting
    const extraSpells = extraSpellsNow(); // racial and feat spells, also for non-casters
    let spell = null;
    if (eff && isCasterType(eff.casterType) && L >= (eff.spellcastingStartLevel || 1)) {
      let slotsRow = [];
      let pact = null;
      if (eff.casterType === 'PACT') {
        // 2014 warlock tables carry slot count/level columns; otherwise use the standard table.
        const count = Number(scalingValue(tableColumn(eff, 'PACT_SLOTS'), L)) || PACT_SLOT_COUNT[L - 1];
        const level = Number(scalingValue(tableColumn(eff, 'PACT_LEVEL'), L)) || Math.min(5, Math.ceil(L / 2));
        pact = { count, level };
      } else if (eff.slotTable) {
        slotsRow = eff.slotTable[L - 1] || []; // 2014: slots straight from the class table
      } else {
        const divisor = eff.casterType === 'HALF' ? 2 : eff.casterType === 'THIRD' ? 3 : 1;
        slotsRow = FULL_SLOTS[Math.max(1, Math.ceil(L / divisor)) - 1] || [];
      }
      const maxLevel = pact ? pact.level : slotsRow.length;
      const abilityKey = eff.spellcastingAbility;
      const abilityMod = mods[abilityKey] ?? 0;
      const cantripLimit = Number(scalingValue(tableColumn(eff, 'CANTRIPS_KNOWN'), L)) || 0;
      // Limit on levelled spells: 2024 "prepared" column, 2014 "known" column, or the
      // 2014 prepared-caster formula (ability mod + class level, halved for half casters).
      const preparedRaw = scalingValue(tableColumn(eff, 'PREPARED_SPELLS'), L);
      const knownRaw = scalingValue(tableColumn(eff, 'SPELLS_KNOWN'), L);
      let preparedLimit = null;
      let limitLabel = 'Подготовлено';
      if (preparedRaw != null) preparedLimit = Number(preparedRaw) || 0;
      else if (knownRaw != null) { preparedLimit = Number(knownRaw) || 0; limitLabel = 'Известно'; }
      else if (eff.edition === '2014') preparedLimit = Math.max(1, abilityMod + (eff.preparedHalfLevel ? Math.floor(L / 2) : L));
      // Always-prepared spells (domain, oath, …) never count against the limits, even if the
      // player also ticked one of them.
      // Racial and feat spells are free the same way.
      const alwaysSpells = alwaysPrepared().map(g => ({ ...g.spell, alwaysFrom: g.from, grantedAt: g.level }));
      for (const x of extraSpells) if (!alwaysSpells.some(a => a.url === x.url)) alwaysSpells.push(x);
      const alwaysUrls = new Set(alwaysSpells.map(x => x.url));
      const chosen = spellPool().filter(sp => s.spells.includes(sp.url) && !alwaysUrls.has(sp.url));
      const cantrips = chosen.filter(sp => sp.level === 0);
      const leveled = chosen.filter(sp => sp.level > 0 && sp.level <= maxLevel);
      spell = {
        type: eff.casterType, abilityKey, abilityMod,
        dc: 8 + pb + abilityMod, attack: pb + abilityMod,
        slotsRow, pact, maxLevel, cantripLimit, preparedLimit, limitLabel, cantrips, leveled,
        always: alwaysSpells, alwaysUrls,
      };
    }

    // Class resources: every non-spell column of the class table, plus counters from mechanics.
    const resources = [];
    for (const col of eff?.table || []) {
      if (['CANTRIPS_KNOWN', 'PREPARED_SPELLS', 'SPELLS_KNOWN', 'PACT_SLOTS', 'PACT_LEVEL'].includes(col.purpose)) continue;
      const v = scalingValue(col, L);
      if (v != null && v !== '' && v !== '—' && v !== '-') resources.push({ name: col.name, value: v });
    }
    const tableKeys = new Set((eff?.table || []).map(col => col.key));
    for (const c of mech.counters) {
      if (c.key && tableKeys.has(c.key)) continue; // already shown from the class table
      let max = c.max;
      if (Array.isArray(c.scaling) && c.scaling.length) {
        max = null;
        for (const step of c.scaling) if (step.level <= L) max = step.max;
        if (max == null) continue; // not unlocked yet
      }
      resources.push({ name: c.name, value: evalCounter(max, { pb, L, mods }), recovery: c.recovery });
    }

    return {
      L, pb, base, scores, mods, sources, bgAbils, slots, feats,
      saves, skills, bgSkills, classSkills, skillData,
      hp, hd, ac, acNote, warnings,
      init: mods.DEXTERITY + (mech.initPB ? pb : 0) + mech.initBonus, initPB: mech.initPB,
      racePlan, extraSpells,
      speed: props.movement?.base || 30, movement: props.movement || {}, size: props.size, creatureType: props.type,
      mech, classFeatures, speciesFeatures, spell, resources,
    };
  }

  function evalCounter(expr, { pb, L, mods }) {
    if (typeof expr === 'number') return expr;
    const text = String(expr ?? '').trim();
    const map = { prof: pb, level: L, str: mods.STRENGTH, dex: mods.DEXTERITY, con: mods.CONSTITUTION, int: mods.INTELLIGENCE, wis: mods.WISDOM, cha: mods.CHARISMA, chr: mods.CHARISMA };
    // Accepts both "@cha" and "@mod.cha" forms used by TTG counters.
    const replaced = text.replace(/@(?:mod\.)?(\w+)/g, (m, k) => (k in map ? String(map[k]) : m));
    if (/^[\d+\-*/ ().]+$/.test(replaced)) {
      try { return Math.max(1, Math.floor(Function(`"use strict";return (${replaced})`)())); } catch { /* fall through */ }
    }
    return text || '—';
  }

  // ---------- builder UI ----------

  const $ = id => document.getElementById(id);
  const el = {
    status: $('status'), name: $('nameInput'), level: $('levelInput'), alignment: $('alignmentSelect'),
    sourceList: $('sourceList'), sourceSummary: $('sourceSummary'), cls: $('classSelect'), subclass: $('subclassSelect'), subclassField: $('subclassField'),
    subclassLabel: $('subclassLabel'), subclassHint: $('subclassHint'), classSkills: $('classSkills'),
    species: $('speciesSelect'), lineage: $('lineageSelect'), lineageField: $('lineageField'),
    speciesTitle: $('speciesTitle'), speciesLabel: $('speciesLabel'), lineageLabel: $('lineageLabel'), raceBonus: $('raceBonus'),
    eyebrow: $('editionEyebrow'),
    background: $('backgroundSelect'), backgroundBonus: $('backgroundBonus'),
    abilityInputs: $('abilityInputs'), abilityHint: $('abilityHint'), featSlots: $('featSlots'),
    spellPanel: $('spellPanel'), spellSummary: $('spellSummary'), spellCounts: $('spellCounts'),
    spellsTab: $('spellsTab'), builderTab: $('builderTab'), tabBtnSpells: $('tabBtnSpells'), tabBtnBuilder: $('tabBtnBuilder'),
    tabSpellCount: $('tabSpellCount'), spellBrowserBody: $('spellBrowserBody'), spellSearch: $('spellSearch'),
    extraSpells: $('extraSpells'),
    filterLevels: $('filterLevels'), filterSchools: $('filterSchools'), filterConcGroup: $('filterConcGroup'),
    filterRitualRow: $('filterRitualRow'), filterRitual: $('filterRitual'), filterNoV: $('filterNoV'), filterNoS: $('filterNoS'),
    filterNoM: $('filterNoM'), filterChosen: $('filterChosen'), filterAvailable: $('filterAvailable'),
    armor: $('armorSelect'), shield: $('shieldInput'), equipment: $('equipmentChoices'),
    languages: $('languagesInput'), notes: $('notesInput'), sheet: $('sheet'),
    dialog: $('detailDialog'), dialogBody: $('detailBody'),
  };
  const rendered = {}; // signatures of rebuilt builder sections

  function setStatus(text, isError = false) {
    el.status.textContent = text;
    el.status.classList.toggle('error', isError);
  }

  function optionsHtml(items, selected, placeholder) {
    const groups = new Map();
    for (const item of items) {
      if (!isAllowed(item)) continue;
      const group = item.source?.group?.rus || 'Прочее';
      if (!groups.has(group)) groups.set(group, { rank: groupRank(item), items: [] });
      groups.get(group).items.push(item);
    }
    let html = `<option value="">${esc(placeholder)}</option>`;
    const ordered = [...groups].sort((a, b) => a[1].rank - b[1].rank);
    for (const [group, { items: groupItems }] of ordered) {
      html += `<optgroup label="${esc(group)}">${groupItems.map(item =>
        `<option value="${esc(item.url)}"${item.url === selected ? ' selected' : ''}>${esc(rus(item))} [${esc(item.source?.name?.label || '')}]</option>`).join('')}</optgroup>`;
    }
    return html;
  }

  function fillMainSelects() {
    el.cls.innerHTML = optionsHtml(lists.classes, state.classUrl, '— выберите класс —');
    el.species.innerHTML = optionsHtml(lists.species, state.speciesUrl, P.labels.speciesPlaceholder);
    el.background.innerHTML = optionsHtml(lists.backgrounds, state.backgroundUrl, '— выберите предысторию —');
  }

  function syncStaticInputs() {
    document.querySelectorAll('input[name="edition"]').forEach(r => { r.checked = r.value === edition; });
    el.eyebrow.textContent = P.eyebrow;
    el.speciesTitle.textContent = P.labels.species;
    el.speciesLabel.textContent = P.labels.species;
    el.lineageLabel.textContent = P.labels.lineage;
    el.name.value = state.name;
    el.level.value = state.level;
    el.alignment.value = state.alignment;
    renderSourcePicker();
    el.armor.value = state.armor;
    el.shield.checked = state.shield;
    el.languages.value = state.languages;
    el.notes.value = state.notes;
    document.querySelectorAll('input[name="abilityMethod"]').forEach(r => { r.checked = r.value === state.abilityMethod; });
  }

  function renderSection(name, signature, build) {
    if (rendered[name] === signature) return false;
    rendered[name] = signature;
    build();
    return true;
  }

  function renderBuilder(c) {
    const { cls, subclasses, lineages, background } = data;

    // Subclass
    const showSub = Boolean(cls?.hasSubclasses && subclasses.length);
    el.subclassField.hidden = !showSub;
    el.subclassHint.hidden = !showSub;
    if (showSub) {
      const lvl = cls.subclassLevel || 3;
      el.subclassLabel.textContent = cls.subclassLabel || 'Подкласс';
      renderSection('subclass', `${cls.url}|${state.subclassUrl}|${sourcesKey()}`, () => {
        el.subclass.innerHTML = optionsHtml(sortByName(subclasses), state.subclassUrl, '— не выбран —');
      });
      el.subclass.disabled = state.level < lvl;
      el.subclassHint.textContent = state.level < lvl ? `Подкласс открывается на ${lvl} уровне.` : '';
    }

    // Lineage
    el.lineageField.hidden = !lineages.length;
    if (lineages.length) {
      renderSection('lineage', `${state.speciesUrl}|${state.lineageUrl}|${lineages.length}|${sourcesKey()}`, () => {
        el.lineage.innerHTML = `<option value="">${esc(P.labels.noLineage)}</option>${lineages.filter(isAllowed).map(x =>
          `<option value="${esc(x.url)}"${x.url === state.lineageUrl ? ' selected' : ''}>${esc(rus(x))}</option>`).join('')}`;
      });
    }

    // Class skills
    renderSection('classSkills', `${cls?.url}|${background?.url}|${lists.skills.length}`, () => {
      const sd = cls?.proficiency?.skillData;
      if (!sd?.skills?.length) { el.classSkills.innerHTML = ''; return; }
      el.classSkills.innerHTML = `<div class="choiceGroup"><div class="choiceTitle" id="classSkillTitle"></div><div class="chips">${
        sd.skills.map(v => {
          const skill = lists.skills.find(x => x.value === v);
          return `<label><input type="checkbox" data-skill="${esc(v)}"> ${esc(skill?.label || v)}</label>`;
        }).join('')}</div></div>`;
    });
    if (c.skillData?.skills?.length) {
      const count = c.skillData.count || 0;
      el.classSkills.querySelectorAll('[data-skill]').forEach(box => {
        const v = box.dataset.skill;
        const fromBg = c.bgSkills.includes(v);
        box.checked = fromBg || c.classSkills.includes(v);
        box.disabled = fromBg || (!box.checked && c.classSkills.length >= count);
        box.parentElement.title = fromBg ? 'Уже даёт предыстория' : '';
      });
      const title = $('classSkillTitle');
      if (title) title.textContent = `Навыки класса: выбрано ${c.classSkills.length} из ${count}`;
    }

    // Race ability bonuses (2014): fixed ones are listed, free ones get pickers.
    renderSection('raceBonus', JSON.stringify([state.speciesUrl, state.lineageUrl, state.raceBonus, c.racePlan.length]), () => {
      if (!c.racePlan.length) { el.raceBonus.innerHTML = ''; return; }
      const fixed = c.racePlan.filter(e => !e.free)
        .map(e => e.candidates.map(k => `${ABILITY[k]?.name} ${signed(e.bonus)}`).join(', ')).filter(Boolean);
      const pickers = c.racePlan.filter(e => e.free).map(e =>
        Array.from({ length: e.count }, (_, i) => `<select data-race-pick="${e.index}" data-index="${i}"><option value="">${signed(e.bonus)} к …</option>${e.candidates.map(k =>
          `<option value="${k}"${e.chosen[i] === k ? ' selected' : ''}>${ABILITY[k]?.name}</option>`).join('')}</select>`).join('')).join('');
      el.raceBonus.innerHTML = `<p class="hint">Бонусы характеристик: ${esc(fixed.join(', ') || '—')}</p>${pickers ? `<div class="bonusPicks">${pickers}</div>` : ''}`;
    });

    // Background: 2024 gives ability bonuses + an origin feat; 2014 gives skills and a feature.
    renderSection('bg', `${edition}|${background?.url}|${state.bgMode}|${c.bgAbils.join()}`, () => {
      if (!background) { el.backgroundBonus.innerHTML = ''; return; }
      if (!P.rules.bgAbilityBonus) {
        el.backgroundBonus.innerHTML = `<p class="hint">Навыки: ${esc(background.skillProficiencies || '—')}${
          background.toolMarkup?.length ? `<br>Инструменты: ${background.toolMarkup.map(inline).join(', ')}` : ''}${
          background.language ? `<br>Языки: ${esc(background.language)}` : ''}${
          background.featureName ? `<br>Умение: ${esc(background.featureName)}` : ''}</p>`;
        return;
      }
      const abilOpts = sel => `<option value="">—</option>${c.bgAbils.map(k =>
        `<option value="${k}"${k === sel ? ' selected' : ''}>${ABILITY[k].name}</option>`).join('')}`;
      el.backgroundBonus.innerHTML = `
        <p class="hint">Навыки: ${esc(background.skillProficiencies || '—')}<br>Черта: ${inline(background.feat || '—')}</p>
        <div class="segmented">
          <label><input type="radio" name="bgMode" value="2-1"${state.bgMode !== '1-1-1' ? ' checked' : ''}> +2 и +1</label>
          <label><input type="radio" name="bgMode" value="1-1-1"${state.bgMode === '1-1-1' ? ' checked' : ''}> +1 к трём (${c.bgAbils.slice(0, 3).map(k => ABILITY[k].short).join(', ')})</label>
        </div>
        ${state.bgMode === '1-1-1' ? '' : `<div class="row">
          <label>+2 к <select data-bg="bgPlus2">${abilOpts(state.bgPlus2)}</select></label>
          <label>+1 к <select data-bg="bgPlus1">${abilOpts(state.bgPlus1)}</select></label>
        </div>`}`;
    });

    // Ability inputs
    renderSection('abilities', state.abilityMethod, () => {
      const m = state.abilityMethod;
      el.abilityInputs.innerHTML = ABILITIES.map(a => {
        let input;
        if (m === 'standard') {
          input = `<select data-abil="${a.key}">${STANDARD_ARRAY.map(v => `<option value="${v}">${v}</option>`).join('')}</select>`;
        } else if (m === 'pointbuy') {
          input = `<select data-abil="${a.key}">${Object.keys(POINT_COST).map(v => `<option value="${v}">${v} (${POINT_COST[v]})</option>`).join('')}</select>`;
        } else {
          input = `<input type="number" min="1" max="30" data-abil="${a.key}">`;
        }
        return `<label>${a.name}${input}<span class="bonus" data-abil-bonus="${a.key}"></span></label>`;
      }).join('') + (m === 'manual'
        ? '<div class="abilityActions"><button type="button" data-action="roll">Бросить 4к6 (без меньшего)</button></div>'
        : m === 'standard' ? '<div class="abilityActions"><button type="button" data-action="auto-assign">Распределить под класс</button></div>' : '');
    });
    const src = state[state.abilityMethod];
    el.abilityInputs.querySelectorAll('[data-abil]').forEach(input => {
      if (document.activeElement !== input) input.value = src[input.dataset.abil];
    });
    el.abilityInputs.querySelectorAll('[data-abil-bonus]').forEach(span => {
      const k = span.dataset.abilBonus;
      const diff = c.scores[k] - c.base[k];
      span.textContent = diff ? `${signed(diff)} → ${c.scores[k]}` : '';
      span.title = c.sources[k].join(', ');
    });
    let hint = '';
    if (state.abilityMethod === 'pointbuy') {
      const spent = ABILITIES.reduce((sum, a) => sum + (POINT_COST[c.base[a.key]] ?? 0), 0);
      hint = `Потрачено очков: ${spent} из ${POINT_BUDGET}.` + (spent > POINT_BUDGET ? ' <span class="warn">Превышен лимит!</span>' : '');
    } else if (state.abilityMethod === 'standard') {
      const values = ABILITIES.map(a => c.base[a.key]).sort((x, y) => y - x);
      if (values.join() !== STANDARD_ARRAY.join()) hint = '<span class="warn">Каждое значение стандартного набора (15, 14, 13, 12, 10, 8) нужно использовать один раз.</span>';
    }
    el.abilityHint.innerHTML = hint;

    renderFeatSlots(c);
    renderSpells(c);
    renderEquipmentChoices();
  }

  function renderFeatSlots(c) {
    const signature = JSON.stringify([c.slots.map(sl => [sl.key, slotFeatUrl(sl)]), state.feats, data.featLists.general.length, data.featLists.epic.length, Object.keys(data.feats).length, sourcesKey()]);
    renderSection('feats', signature, () => {
      if (!c.slots.length) {
        el.featSlots.innerHTML = P.rules.originFeat
          ? '<p class="hint">Черта появится с предысторией, дополнительные — при улучшении характеристик (обычно 4, 8, 12, 16 и 19 уровни).</p>'
          : '<p class="hint">На уровнях увеличения характеристик (обычно 4, 8, 12, 16 и 19) можно повысить характеристики или взять черту.</p>';
        return;
      }
      el.featSlots.innerHTML = c.slots.map(slot => {
        const url = slotFeatUrl(slot);
        const feat = url ? data.feats[url] : null;
        let picker;
        if (slot.fixed) {
          picker = `<div>${feat ? `<button type="button" class="linkish" data-feat-info="${esc(url)}">${esc(rus(feat))}</button>` : esc(url)}</div>`;
        } else {
          const groups = slot.epic ? [['Эпические черты', data.featLists.epic], ['Общие черты', data.featLists.general]]
            : [[P.rules.originFeat ? 'Общие черты' : 'Черты', data.featLists.general]];
          const asiOption = slot.asi
            ? `<option value="${ASI_FEAT.url}"${url === ASI_FEAT.url ? ' selected' : ''}>Увеличение характеристик (+2 или +1/+1)</option>` : '';
          picker = `<select data-feat-slot="${slot.key}"><option value="">— выберите черту —</option>${asiOption}${groups.map(([label, items]) =>
            `<optgroup label="${label}">${items.filter(isAllowed).map(f =>
              `<option value="${esc(f.url)}"${f.url === url ? ' selected' : ''}>${esc(rus(f))} [${esc(f.source?.name?.label || '')}]</option>`).join('')}</optgroup>`).join('')}</select>
            ${feat && url !== ASI_FEAT.url ? `<button type="button" class="linkish" data-feat-info="${esc(url)}">Описание</button>` : ''}`;
        }
        const plan = featBonusPlan(slot);
        let bonus = '';
        if (plan) {
          const opts = plan.options.length > 1 ? `<select data-feat-option="${slot.key}">${plan.options.map((o, i) =>
            `<option value="${i}"${i === plan.optionIndex ? ' selected' : ''}>+${o.bonus} к ${o.count === 1 ? 'одной характеристике' : `${o.count} характеристикам`}</option>`).join('')}</select>` : '';
          const picks = plan.candidates.length <= plan.count
            ? `<div class="hint">+${plan.option.bonus}: ${plan.candidates.map(k => ABILITY[k]?.name).join(', ')}</div>`
            : Array.from({ length: plan.count }, (_, i) => `<select data-feat-pick="${slot.key}" data-index="${i}"><option value="">+${plan.option.bonus} к …</option>${plan.candidates.map(k =>
              `<option value="${k}"${plan.chosen[i] === k ? ' selected' : ''}>${ABILITY[k]?.name}</option>`).join('')}</select>`).join('');
          bonus = `<div class="bonusPicks">${opts}${picks}</div>`;
        }
        const prereq = feat?.prerequisite ? `<div class="hint">Требование: ${esc(feat.prerequisite)}</div>` : '';
        return `<div class="featSlot"><div class="slotTitle">${esc(slot.title)}</div>${picker}${prereq}${bonus}</div>`;
      }).join('');
    });
  }

  // ---------- spells tab ----------

  const defaultSpellFilter = () => ({
    search: '', levels: new Set(), schools: new Set(), conc: 'any', ritual: false,
    noV: false, noS: false, noM: false, chosen: false, available: true,
  });
  let spellFilter = defaultSpellFilter();
  let lastComputed = null;

  const levelName = lvl => (lvl === 0 ? 'Заговоры' : `${lvl} уровень`);

  function spellMatches(x, sp) {
    const f = spellFilter;
    // Granted spells come with the subclass, whatever books are ticked.
    const chosen = state.spells.includes(x.url) || sp.alwaysUrls.has(x.url);
    if (!isAllowed(x) && !chosen) return false;
    if (x.level === 0 && !sp.cantripLimit && !chosen) return false; // class has no cantrips
    if (f.available && x.level > sp.maxLevel && !chosen) return false;
    if (f.chosen && !chosen) return false;
    if (f.levels.size && !f.levels.has(x.level)) return false;
    if (f.schools.size && !f.schools.has(x.school)) return false;
    if (f.conc === 'yes' && !x.concentration) return false;
    if (f.conc === 'no' && x.concentration) return false;
    if (f.ritual && !x.ritual) return false;
    const comp = x.components || {};
    if ((f.noV && comp.v) || (f.noS && comp.s) || (f.noM && comp.m)) return false;
    if (f.search) {
      const q = f.search.toLowerCase();
      if (!rus(x).toLowerCase().includes(q) && !(x.name?.eng || '').toLowerCase().includes(q)) return false;
    }
    return true;
  }

  function spellCountsHtml(sp) {
    const parts = [];
    if (sp.cantripLimit) parts.push(`Заговоры: <b>${sp.cantrips.length} / ${sp.cantripLimit}</b>`);
    parts.push(sp.preparedLimit != null
      ? `${sp.limitLabel}: <b>${sp.leveled.length} / ${sp.preparedLimit}</b>`
      : `${sp.limitLabel}: <b>${sp.leveled.length}</b>`);
    if (sp.always.length) parts.push(`+ всегда подготовлены: <b>${sp.always.length}</b>`);
    parts.push(`макс. уровень: <b>${sp.maxLevel}</b>`);
    const over = sp.cantrips.length > sp.cantripLimit || (sp.preparedLimit != null && sp.leveled.length > sp.preparedLimit);
    return parts.join(' · ') + (over ? ' <span class="warn">— больше лимита, снимите лишние.</span>' : '');
  }

  // Racial and feat spells: fixed grants are listed, choices get pickers.
  function renderExtraSpells(c) {
    const sources = data.spellSources || [];
    const signature = JSON.stringify([sources.map(s => [s.key, s.title, s.fixed.length, s.choices.map(ch => [ch.key, ch.count])]),
      state.extraSpells, state.level, Object.entries(data.spellCandidates || {}).map(([k, v]) => [k, v.length]), sourcesKey()]);
    renderSection('extraSpells', signature, () => {
      if (!sources.length) { el.extraSpells.innerHTML = ''; return; }
      const spellLink = x => `<button type="button" class="linkish" data-spell-info="${esc(x.url)}">${esc(rus(x))}</button>`;
      el.extraSpells.innerHTML = `<section class="extraSpells">
        <h3>Заклинания расы и черт <span class="muted">— всегда подготовлены, не учитываются в лимите</span></h3>
        ${sources.map(src => {
          const pick = state.extraSpells[src.key] || {};
          const fixed = src.fixed.filter(f => f.spell).map(f => f.level <= state.level
            ? `<li>${spellLink(f.spell)} <span class="muted">${f.spell.level ? `${f.spell.level} ур.` : 'заговор'}</span></li>`
            : `<li class="muted">${esc(rus(f.spell))} — с ${f.level} уровня персонажа</li>`).join('');
          const list = src.listOptions ? `<label>Список заклинаний <select data-extra-list="${esc(src.key)}">
            <option value="">— выберите класс —</option>${src.listOptions.map(o =>
              `<option value="${esc(o.value)}"${o.value === sourceListRef(src, { list: 'choice' }) ? ' selected' : ''}>${esc(o.label)}</option>`).join('')}</select></label>` : '';
          const choices = src.choices.map(ch => {
            const cands = (data.spellCandidates[`${src.key}:${ch.key}`] || []).filter(x => isAllowed(x) || (pick.picks?.[ch.key] || []).includes(x.url));
            const ref = sourceListRef(src, ch);
            if (!ref) return `<p class="hint">${esc(ch.label)}: сначала выберите список заклинаний.</p>`;
            const picks = pick.picks?.[ch.key] || [];
            return `<div class="choiceGroup"><div class="choiceTitle">${esc(ch.label)}${ch.count > 1 ? ` (${ch.count})` : ''}</div>
              <div class="bonusPicks">${Array.from({ length: ch.count }, (_, i) => `<select data-extra-pick="${esc(src.key)}" data-choice="${esc(ch.key)}" data-index="${i}">
                <option value="">— выберите —</option>${cands.map(x =>
                  `<option value="${esc(x.url)}"${picks[i] === x.url ? ' selected' : ''}>${esc(rus(x))}${x.school ? ` · ${esc(x.school)}` : ''}</option>`).join('')}</select>`).join('')}</div></div>`;
          }).join('');
          return `<div class="extraSource"><div class="slotTitle">${esc(src.title)} <span class="tag">${esc(src.tag)}</span></div>
            ${fixed ? `<ul class="list">${fixed}</ul>` : ''}${list}${choices}</div>`;
        }).join('')}
      </section>`;
    });
  }

  function renderSpells(c) {
    lastComputed = c;
    const sp = c.spell;
    renderExtraSpells(c);
    el.spellPanel.hidden = !sp && !c.extraSpells.length;
    el.tabSpellCount.textContent = sp ? String(sp.cantrips.length + sp.leveled.length + sp.always.length)
      : c.extraSpells.length ? String(c.extraSpells.length) : '';

    if (!sp) {
      el.spellSummary.innerHTML = c.extraSpells.length ? `Заклинания расы и черт: <b>${c.extraSpells.length}</b>` : '';
      const eff = data.eff;
      const startsLater = eff && isCasterType(eff.casterType) && state.level < (eff.spellcastingStartLevel || 1);
      el.spellCounts.innerHTML = '';
      el.spellBrowserBody.innerHTML = `<p class="sheetEmpty">${
        !data.cls ? 'Выберите класс на вкладке «Персонаж».'
          : startsLater ? `Заклинания появятся с ${eff.spellcastingStartLevel} уровня.`
            : data.subclasses.length && !data.subclass ? 'Класс не использует заклинания (некоторые подклассы — используют).'
              : c.extraSpells.length || (data.spellSources || []).length ? 'Класс не даёт заклинаний.'
                : 'Этот персонаж не использует заклинания.'}</p>`;
      rendered.spellRows = '';
      return;
    }

    const summary = spellCountsHtml(sp);
    el.spellSummary.innerHTML = summary;
    el.spellCounts.innerHTML = summary;

    // Everything the tab can show: the pickable pool plus granted spells outside the class list.
    const pickable = spellPool();
    const pickableUrls = new Set(pickable.map(x => x.url));
    const browse = [...pickable, ...sp.always.filter(x => !pickableUrls.has(x.url))];
    const alwaysFrom = new Map(sp.always.map(x => [x.url, x.alwaysFrom]));
    const alwaysTag = new Map(sp.always.map(x => [x.url, x.sourceTag || 'всегда']));
    const grantedKey = [...sp.alwaysUrls].join(',') + '|' + pickable.filter(x => x.expanded).length;

    // Filter chips depend on the spell list (edition, class, books).
    const pool = browse.filter(x => isAllowed(x) || state.spells.includes(x.url) || sp.alwaysUrls.has(x.url));
    renderSection('spellChips', `${data.spellsKey}|${sourcesKey()}|${grantedKey}`, () => {
      const levels = [...new Set(pool.map(x => x.level))].sort((a, b) => a - b);
      const schools = [...new Set(pool.map(x => x.school).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
      el.filterLevels.innerHTML = levels.map(l => `<label><input type="checkbox" data-filter-level="${l}"${spellFilter.levels.has(l) ? ' checked' : ''}> ${l === 0 ? 'Заговор' : l}</label>`).join('');
      el.filterSchools.innerHTML = schools.map(s => `<label><input type="checkbox" data-filter-school="${esc(s)}"${spellFilter.schools.has(s) ? ' checked' : ''}> ${esc(s)}</label>`).join('');
      // The 2014 list data has no concentration/ritual flags; hide filters it cannot answer.
      el.filterConcGroup.hidden = !pool.some(x => x.concentration);
      el.filterRitualRow.hidden = !pool.some(x => x.ritual);
    });

    const f = spellFilter;
    const filterKey = JSON.stringify([f.search, [...f.levels], [...f.schools], f.conc, f.ritual, f.noV, f.noS, f.noM, f.available,
      f.chosen ? state.spells : null]);
    renderSection('spellRows', `${data.spellsKey}|${sp.maxLevel}|${sp.cantripLimit}|${sourcesKey()}|${grantedKey}|${filterKey}`, () => {
      const items = browse.filter(x => spellMatches(x, sp));
      const byLevel = new Map();
      for (const x of items) {
        if (!byLevel.has(x.level)) byLevel.set(x.level, []);
        byLevel.get(x.level).push(x);
      }
      const comps = x => ['v', 's', 'm'].filter(k => x.components?.[k]).map(k => ({ v: 'В', s: 'С', m: 'М' })[k]).join(', ');
      el.spellBrowserBody.innerHTML = items.length ? `<p class="hint">Найдено: ${items.length}</p><div class="spellTableWrap"><table class="spellTable spellList">
        <thead><tr><th></th><th>Название</th><th>Школа</th><th>Компоненты</th><th>Книга</th></tr></thead>
        ${[...byLevel.keys()].sort((a, b) => a - b).map(lvl => `<tbody>
          <tr class="levelRow"><th colspan="5">${levelName(lvl)}${lvl > sp.maxLevel ? ' <span class="muted">— пока недоступно</span>' : ''}</th></tr>
          ${byLevel.get(lvl).map(x => `<tr data-row="${esc(x.url)}">
            <td><input type="checkbox" data-spell="${esc(x.url)}" data-level="${x.level}" aria-label="${esc(rus(x))}"></td>
            <td><button type="button" class="linkish" data-spell-info="${esc(x.url)}">${esc(rus(x))}</button>
              ${x.concentration ? '<span class="tag" title="Концентрация">К</span>' : ''}${x.ritual ? '<span class="tag" title="Ритуал">Р</span>' : ''}
              ${alwaysFrom.has(x.url) ? `<span class="tag always" title="Всегда подготовлено, не учитывается в лимите: ${esc(alwaysFrom.get(x.url))}">${esc(alwaysTag.get(x.url))}</span>` : ''}
              ${x.expanded ? '<span class="tag" title="Расширенный список заклинаний покровителя">покровитель</span>' : ''}
              ${x.name?.eng ? `<div class="eng">${esc(x.name.eng)}</div>` : ''}</td>
            <td>${esc(x.school || '')}</td>
            <td>${comps(x)}</td>
            <td class="muted">${esc(x.source?.name?.label || '')}</td>
          </tr>`).join('')}</tbody>`).join('')}
      </table></div>` : '<p class="sheetEmpty">Ничего не найдено — измените фильтры.</p>';
    });

    // Checkbox state changes with every pick, without rebuilding the table.
    const cantripsFull = sp.cantrips.length >= sp.cantripLimit;
    const preparedFull = sp.preparedLimit != null && sp.leveled.length >= sp.preparedLimit;
    el.spellBrowserBody.querySelectorAll('[data-spell]').forEach(box => {
      const level = Number(box.dataset.level);
      const row = box.closest('tr');
      if (sp.alwaysUrls.has(box.dataset.spell)) {
        box.checked = true;
        box.disabled = true;
        box.title = 'Всегда подготовлено — не учитывается в лимите';
        row.classList.add('chosen', 'always');
        row.classList.remove('disabled');
        return;
      }
      row.classList.remove('always');
      box.checked = state.spells.includes(box.dataset.spell);
      const full = level === 0 ? cantripsFull : preparedFull;
      const tooHigh = level > sp.maxLevel;
      box.disabled = !box.checked && (full || tooHigh);
      box.title = tooHigh ? 'Недоступно на текущем уровне' : full && !box.checked ? 'Достигнут лимит' : '';
      row.classList.toggle('chosen', box.checked);
      row.classList.toggle('disabled', box.disabled);
    });
  }

  function syncSpellFilterInputs() {
    el.spellSearch.value = spellFilter.search;
    document.querySelectorAll('input[name="filterConc"]').forEach(r => { r.checked = r.value === spellFilter.conc; });
    el.filterRitual.checked = spellFilter.ritual;
    el.filterNoV.checked = spellFilter.noV;
    el.filterNoS.checked = spellFilter.noS;
    el.filterNoM.checked = spellFilter.noM;
    el.filterChosen.checked = spellFilter.chosen;
    el.filterAvailable.checked = spellFilter.available;
    rendered.spellChips = '';
  }

  // ---------- tabs ----------

  const TAB_KEY = 'mg-dnd-tab';
  function setTab(name, { scroll = false } = {}) {
    const spells = name === 'spells';
    el.spellsTab.hidden = !spells;
    el.builderTab.hidden = spells;
    el.tabBtnSpells.setAttribute('aria-selected', String(spells));
    el.tabBtnBuilder.setAttribute('aria-selected', String(!spells));
    try { localStorage.setItem(TAB_KEY, name); } catch { /* storage blocked */ }
    if (scroll) el.tabBtnBuilder.scrollIntoView({ block: 'nearest' });
  }

  function renderEquipmentChoices() {
    const { cls, background } = data;
    renderSection('equip', `${cls?.url}|${background?.url}|${state.classEquip}|${state.bgEquip}`, () => {
      const group = (title, options, key, selected) => {
        if (!options?.length) return '';
        return `<div class="choiceGroup"><div class="choiceTitle">${title}</div><div class="chips">${options.map((o, i) =>
          `<label><input type="radio" name="${key}" data-equip="${key}" value="${i}"${i === selected ? ' checked' : ''}> Вариант ${esc(o.label || i + 1)}</label>`).join('')}</div></div>`;
      };
      const html = group('Стартовое снаряжение класса', cls?.startingEquipment, 'classEquip', state.classEquip)
        + group('Снаряжение предыстории', background?.startingEquipment, 'bgEquip', state.bgEquip);
      // 2014 data lists equipment as text with "а) или б)" options; it is shown on the sheet.
      el.equipment.innerHTML = html || (cls?.equipmentMarkup?.length || background?.equipmentMarkup?.length
        ? '<p class="hint">Стартовое снаряжение класса и предыстории показано в листе.</p>' : '');
    });
  }

  // ---------- sheet ----------

  function equipmentText(option) {
    if (!option) return '';
    const items = (option.items || []).map(it => `${esc(it.name || it.url)}${it.quantity > 1 ? ` ×${it.quantity}` : ''}${it.description ? ` <span class="muted">(${esc(it.description)})</span>` : ''}`);
    if (option.coins) items.push(`${option.coins} ${esc(option.coin || 'зм')}`);
    return items.join(', ');
  }

  function dictLabel(dict, value) {
    return dict[value] || String(value).toLowerCase().replace(/_/g, ' ');
  }

  function renderSheet(c) {
    const s = state;
    const { cls, subclass, eff, species, lineage, background } = data;
    const openKeys = new Set([...el.sheet.querySelectorAll('details[open][data-key]')].map(d => d.dataset.key));

    const classLine = cls
      ? `${esc(rus(cls))}${subclass ? ` (${esc(rus(subclass))})` : ''}, ${s.level} уровень`
      : `Персонаж ${s.level} уровня`;
    // 2014 subrace names already include the race ("Дварф (холмовой)").
    const speciesName = !species ? '—'
      : lineage ? (edition === '2014' ? esc(rus(lineage)) : `${esc(rus(species))} — ${esc(rus(lineage))}`)
        : esc(rus(species));

    const abilities = ABILITIES.map(a => `
      <div class="ability" title="${esc(c.sources[a.key].join(', '))}">
        <div class="abbr">${a.short}</div>
        <div class="mod">${signed(c.mods[a.key])}</div>
        <div class="score">${c.scores[a.key]}</div>
      </div>`).join('');

    const saveRows = ABILITIES.map(a => {
      const prof = c.saves.has(a.key);
      return `<li><span class="pip${prof ? ' on' : ''}"></span><span class="val">${signed(c.mods[a.key] + (prof ? c.pb : 0))}</span> ${a.name}</li>`;
    }).join('');

    const skillValue = skill => c.mods[skill.ability] + (c.skills.has(skill.value) ? c.pb : 0);
    const skillRows = lists.skills.map(skill => {
      const prof = c.skills.has(skill.value);
      return `<li><span class="pip${prof ? ' on' : ''}"></span><span class="val">${signed(skillValue(skill))}</span> ${esc(skill.label)}<span class="abil">${ABILITY[skill.ability]?.short || ''}</span></li>`;
    }).join('');
    const perception = lists.skills.find(x => x.value === 'PERCEPTION');
    const passive = 10 + (perception ? skillValue(perception) : c.mods.WISDOM) + c.mech.passiveBonus;

    const prof = cls?.proficiency || {};
    const tools = [prof.tool, ...(background?.toolProficiencies || []).map(t => {
      const item = (background.startingEquipment || []).flatMap(o => o.items || []).find(i => i.url === t.url);
      return item?.name || t.url;
    })].filter(Boolean).map(esc);
    for (const markup of background?.toolMarkup || []) tools.push(inline(markup)); // 2014 text

    const senses = Object.entries(c.mech.senses).map(([k, v]) => `${SENSE_NAMES[k] || k} ${v} фт.`);
    const movement = [`${c.speed} фт.`];
    for (const [k, label] of [['fly', 'полёт'], ['swim', 'плавание'], ['climb', 'лазание'], ['burrow', 'копание']]) {
      if (c.movement[k]) movement.push(`${label} ${c.movement[k]} фт.`);
    }

    const traits = [];
    if (senses.length) traits.push(['Чувства', senses.join(', ')]);
    if (c.mech.resist.size) traits.push(['Сопротивления', [...c.mech.resist].map(x => dictLabel(lists.damage, x)).join(', ')]);
    if (c.mech.immune.size) traits.push(['Иммунитеты', [...c.mech.immune].map(x => dictLabel(lists.damage, x)).join(', ')]);
    if (c.mech.vuln.size) traits.push(['Уязвимости', [...c.mech.vuln].map(x => dictLabel(lists.damage, x)).join(', ')]);
    if (c.mech.condImm.size) traits.push(['Иммунитет к состояниям', [...c.mech.condImm].map(x => dictLabel(lists.conditions, x)).join(', ')]);
    if (c.size) traits.push(['Размер', esc(c.size)]);
    if (c.creatureType) traits.push(['Тип', esc(c.creatureType)]);

    const feature = (key, title, level, desc, tag) => `
      <details class="feature" data-key="${esc(key)}"${openKeys.has(key) ? ' open' : ''}>
        <summary><span>${esc(title)}</span>${tag ? `<span class="tag">${esc(tag)}</span>` : ''}${level ? `<span class="lvl">${level} ур.</span>` : ''}</summary>
        ${rich(desc)}
      </details>`;
    const classFeatureHtml = c.classFeatures.map((f, i) => feature(`c-${f.key || i}-${f.level}`, f.name, f.level, f.description,
      f.isSubclass ? 'подкласс' : f.optional ? 'опционально' : '')).join('');
    const speciesFeatureHtml = c.speciesFeatures.map((f, i) => feature(`s-${i}-${rus(f)}`, rus(f), null, f.description)).join('');
    const bgFeatureHtml = background?.featureName
      ? feature(`b-${background.url}`, background.featureName, null, background.featureDescription, 'предыстория') : '';
    const featHtml = bgFeatureHtml + c.feats.map(({ slot, feat }) => feature(`f-${slot.key}-${feat.url}`, rus(feat), slot.level, feat.description, feat.category)).join('');

    let spellHtml = '';
    if (!c.spell && c.extraSpells.length) {
      // No class spellcasting: list racial/feat spells on their own.
      const rows = [...c.extraSpells].sort((a, b) => a.level - b.level || rus(a).localeCompare(rus(b), 'ru'));
      spellHtml = `
        <section class="box">
          <h3>Врождённые заклинания</h3>
          <table class="spellTable"><tr><th>Ур.</th><th>Название</th><th>Школа</th><th>Источник</th></tr>${rows.map(x => `
            <tr><td>${x.level || 'з'}</td>
              <td><button type="button" class="linkish" data-spell-info="${esc(x.url)}">${esc(rus(x))}</button></td>
              <td>${esc(x.school || '')}</td>
              <td><span class="tag always">${esc(x.sourceTag || '')}</span> ${esc(x.alwaysFrom || '')}</td></tr>`).join('')}</table>
        </section>`;
    }
    if (c.spell) {
      const sp = c.spell;
      const slotHtml = sp.pact
        ? `<div class="slot"><b>${sp.pact.count}</b>ячейки ${sp.pact.level} ур.</div>`
        : sp.slotsRow.map((n, i) => `<div class="slot"><b>${n}</b>${i + 1} ур.</div>`).join('');
      const rows = [...sp.cantrips, ...sp.leveled, ...sp.always].sort((a, b) => a.level - b.level || rus(a).localeCompare(rus(b), 'ru'));
      spellHtml = `
        <section class="box">
          <h3>Заклинания · ${esc(CASTER_NAMES[sp.type] || '')}</h3>
          <div class="combat">
            <div class="stat"><b>${esc(ABILITY[sp.abilityKey]?.short || '—')}</b><span>Базовая характеристика</span></div>
            <div class="stat"><b>${sp.dc}</b><span>Сл спасброска</span></div>
            <div class="stat"><b>${signed(sp.attack)}</b><span>Бонус атаки</span></div>
          </div>
          <div class="slots">${slotHtml}</div>
          ${rows.length ? `<table class="spellTable"><tr><th>Ур.</th><th>Название</th><th>Школа</th><th>Компоненты</th></tr>${rows.map(x => `
            <tr><td>${x.level || 'з'}</td>
              <td><button type="button" class="linkish" data-spell-info="${esc(x.url)}">${esc(rus(x))}</button>${x.concentration ? ' <span class="tag">К</span>' : ''}${x.ritual ? ' <span class="tag">Р</span>' : ''}${x.alwaysFrom ? ` <span class="tag always" title="Всегда подготовлено: ${esc(x.alwaysFrom)}">${esc(x.sourceTag || 'всегда')}</span>` : ''}</td>
              <td>${esc(x.school || '')}</td>
              <td>${['v', 's', 'm'].filter(k => x.components?.[k]).map(k => ({ v: 'В', s: 'С', m: 'М' })[k]).join(', ')}</td></tr>`).join('')}</table>`
            : '<p class="muted">Выберите заклинания в конструкторе.</p>'}
        </section>`;
    }

    const equipment = [
      cls?.startingEquipment?.length ? `<dt>Класс (вариант ${esc(cls.startingEquipment[s.classEquip]?.label || '')})</dt><dd>${equipmentText(cls.startingEquipment[s.classEquip])}</dd>` : '',
      background?.startingEquipment?.length ? `<dt>Предыстория (вариант ${esc(background.startingEquipment[s.bgEquip]?.label || '')})</dt><dd>${equipmentText(background.startingEquipment[s.bgEquip])}</dd>` : '',
      // 2014: equipment is descriptive text (with "а) или б)" choices) rather than structured options.
      cls?.equipmentMarkup?.length ? `<dt>Класс</dt><dd>${rich(cls.equipmentMarkup)}</dd>` : '',
      background?.equipmentMarkup?.length ? `<dt>Предыстория</dt><dd>${background.equipmentMarkup.map(inline).join(', ')}</dd>` : '',
    ].join('');

    el.sheet.innerHTML = `
      <header class="sheetHeader">
        <div>
          <div class="charName">${esc(s.name || 'Безымянный герой')}</div>
          <div class="charSub">${classLine}</div>
        </div>
        <div class="facts">
          <div class="fact"><span>${esc(P.labels.species)}</span><b>${speciesName}</b></div>
          <div class="fact"><span>Предыстория</span><b>${background ? esc(rus(background)) : '—'}</b></div>
          <div class="fact"><span>Мировоззрение</span><b>${esc(s.alignment || '—')}</b></div>
          <div class="fact"><span>Кость хитов</span><b>${c.hd ? `${s.level}${esc(c.hd.label)}` : '—'}</b></div>
          <div class="fact"><span>Бонус мастерства</span><b>${signed(c.pb)}</b></div>
          <div class="fact"><span>Пасс. внимательность</span><b>${passive}</b></div>
        </div>
      </header>

      <div class="abilities">${abilities}</div>

      <div class="combat">
        <div class="stat"><b>${c.ac}</b><span>Класс доспеха</span><small>${esc(c.acNote)}</small></div>
        <div class="stat"><b>${c.hp || '—'}</b><span>Хиты</span><small>${c.hd ? `${c.hd.maxValue} + ${esc(c.hd.label)} за уровень` : ''}</small></div>
        <div class="stat"><b>${signed(c.init)}</b><span>Инициатива</span><small>${c.initPB ? 'с бонусом мастерства' : ''}</small></div>
        <div class="stat"><b>${c.speed}</b><span>Скорость, фт.</span><small>${esc(movement.slice(1).join(', '))}</small></div>
      </div>
      ${c.warnings.length ? `<p class="hint warn">${c.warnings.map(esc).join('. ')}</p>` : ''}

      <div class="columns">
        <div>
          <section class="box"><h3>Спасброски</h3><ul class="list">${saveRows}</ul></section>
          <section class="box"><h3>Навыки</h3><ul class="list">${skillRows}</ul></section>
          <section class="box"><h3>Владения</h3>
            <dl class="kv">
              <dt>Доспехи</dt><dd>${esc(prof.armor || '—')}</dd>
              <dt>Оружие</dt><dd>${esc(prof.weapon || '—')}</dd>
              <dt>Инструменты</dt><dd>${tools.join(', ') || '—'}</dd>
              <dt>Языки</dt><dd>${esc(s.languages || '—')}</dd>
            </dl>
          </section>
        </div>
        <div>
          ${traits.length ? `<section class="box"><h3>Особенности</h3><dl class="kv">${traits.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl></section>` : ''}
          ${c.resources.length ? `<section class="box"><h3>Ресурсы</h3><ul class="list">${c.resources.map(r =>
            `<li><span class="val">${esc(r.value)}</span> ${esc(r.name)}${RECOVERY_NAMES[r.recovery] ? `<span class="abil">${RECOVERY_NAMES[r.recovery]}</span>` : ''}</li>`).join('')}</ul></section>` : ''}
          <section class="box"><h3>Умения класса</h3>${classFeatureHtml || '<p class="muted">Выберите класс.</p>'}</section>
          <section class="box"><h3>${edition === '2014' ? 'Расовые особенности' : 'Черты вида'}</h3>${speciesFeatureHtml || `<p class="muted">${species ? 'Нет особых черт.' : `Выберите: ${esc(P.labels.species.toLowerCase())}.`}</p>`}</section>
          <section class="box"><h3>Черты</h3>${featHtml || '<p class="muted">Черт пока нет.</p>'}</section>
        </div>
      </div>
      ${spellHtml}
      ${equipment ? `<section class="box"><h3>Снаряжение</h3><dl class="kv">${equipment}</dl></section>` : ''}
      ${s.notes ? `<section class="box"><h3>Заметки</h3><p style="white-space:pre-wrap">${esc(s.notes)}</p></section>` : ''}
      <p class="hint">Правила D&amp;D ${edition}. Источник данных: TTG Club${edition === '2014' ? ' (5e14)' : ''}. ${eff?.source?.name ? `Класс: ${esc(eff.source.name.rus || eff.source.name.label)}.` : ''}</p>`;
  }

  // ---------- update loop ----------

  let generation = 0;
  async function update() {
    const mine = ++generation;
    save();
    try {
      setStatus('Загрузка…');
      await loadData();
      if (mine !== generation) return;
      // Enforce the official-only filter on every update, not just when the checkbox is
      // clicked: a saved or imported character may already carry third-party picks.
      const removed = dropDisallowedChoices();
      if (removed.length) {
        save();
        fillMainSelects();
        await loadData();
        if (mine !== generation) return;
        setStatus(`Сброшено (нет в выбранных источниках): ${removed.join(', ')}`);
      } else {
        setStatus('Сохранено');
      }
    } catch (err) {
      if (mine !== generation) return;
      console.error(err);
      setStatus('Не удалось загрузить данные TTG Club', true);
    }
    const c = compute();
    renderBuilder(c);
    renderSheet(c);
  }

  // ---------- events ----------

  function setAndUpdate(patch) {
    Object.assign(state, patch);
    update();
  }

  el.name.addEventListener('input', () => {
    state.name = el.name.value;
    save();
    const name = el.sheet.querySelector('.charName');
    if (name) name.textContent = state.name || 'Безымянный герой';
  });
  el.level.addEventListener('change', () => {
    state.level = clampInt(el.level.value, 1, 20, 1);
    el.level.value = state.level;
    update();
  });
  el.alignment.addEventListener('change', () => setAndUpdate({ alignment: el.alignment.value }));
  function setSources(sources) {
    state.sources = [...new Set(sources)];
    renderSourcePicker();
    fillMainSelects();
    update(); // update() drops picks that are no longer in the selected books
  }
  el.sourceList.addEventListener('change', event => {
    const label = event.target.dataset.source;
    if (!label) return;
    // Expand '*' into concrete labels before removing one.
    const current = state.sources.includes('*') ? knownSources().map(x => x.label) : state.sources;
    setSources(event.target.checked ? [...current, label] : current.filter(x => x !== label));
  });
  document.querySelectorAll('[data-sources]').forEach(btn => btn.addEventListener('click', () => {
    const mode = btn.dataset.sources;
    setSources(mode === 'all' ? ['*'] : mode === 'none' ? [] : DEFAULT_SOURCES);
  }));

  function renderSourcePicker() {
    const groups = new Map();
    for (const src of knownSources()) {
      const key = src.group?.rus || 'Прочее';
      if (!groups.has(key)) groups.set(key, { rank: GROUP_ORDER[src.group?.label] ?? 3, items: [] });
      groups.get(key).items.push(src);
    }
    el.sourceList.innerHTML = [...groups].sort((a, b) => a[1].rank - b[1].rank).map(([name, g]) =>
      `<div class="sourceGroup"><div class="choiceTitle">${esc(name)}</div><div class="chips">${
        g.items.sort((a, b) => a.label.localeCompare(b.label)).map(src =>
          `<label title="${esc(src.rus)}${src.noData ? ' — этой книги нет в TTG API' : ''}"><input type="checkbox" data-source="${esc(src.label)}"${sourceTicked(src.label) ? ' checked' : ''}> ${esc(src.label)}${src.noData ? ' <span class="noData">нет данных</span>' : ''}</label>`).join('')
      }</div></div>`).join('');
    const n = state.sources.length;
    const noData = knownSources().filter(src => src.noData).map(src => src.label);
    const missing = state.sources.filter(label => noData.includes(label));
    el.sourceSummary.title = missing.length ? `${missing.join(', ')}: этих книг нет в TTG API — с них ничего не найдётся` : '';
    el.sourceSummary.textContent = allSourcesSelected() ? 'все'
      : n === 0 ? 'ничего не выбрано'
      : n <= 4 ? state.sources.join(', ') : `${state.sources.slice(0, 4).join(', ')} +${n - 4}`;
  }

  // With the filter on, every pick must come from an official source; a hidden-but-applied
  // third-party choice would silently keep changing the sheet.
  function dropDisallowedChoices() {
    const removed = [];
    const find = (list, url) => list.find(x => x.url === url);
    const bad = item => item && !isAllowed(item);

    const cls = find(lists.classes, state.classUrl);
    if (bad(cls)) {
      removed.push(rus(cls));
      Object.assign(state, { classUrl: '', subclassUrl: '', classSkills: [], spells: [], classEquip: 0 });
    }
    const sub = find(data.subclasses, state.subclassUrl);
    if (state.subclassUrl && bad(sub)) { removed.push(rus(sub)); state.subclassUrl = ''; }

    const species = find(lists.species, state.speciesUrl);
    if (bad(species)) { removed.push(rus(species)); Object.assign(state, { speciesUrl: '', lineageUrl: '' }); }
    const lineage = find(data.lineages, state.lineageUrl);
    if (state.lineageUrl && bad(lineage)) { removed.push(rus(lineage)); state.lineageUrl = ''; }

    const bg = find(lists.backgrounds, state.backgroundUrl);
    if (bad(bg)) {
      removed.push(rus(bg));
      const feats = { ...state.feats };
      delete feats.origin;
      Object.assign(state, { backgroundUrl: '', bgPlus2: '', bgPlus1: '', bgEquip: 0, feats });
    }

    const featPool = [...data.featLists.general, ...data.featLists.epic];
    for (const [key, entry] of Object.entries(state.feats)) {
      if (key === 'origin' || entry?.url === ASI_FEAT.url) continue; // fixed by background / not a book feat
      const feat = find(featPool, entry?.url) || data.feats[entry?.url];
      if (bad(feat)) { removed.push(rus(feat)); state.feats = { ...state.feats, [key]: { url: '', option: 0, picks: [] } }; }
    }

    const pool = spellPool();
    const keptSpells = state.spells.filter(url => !bad(find(pool, url)));
    if (keptSpells.length !== state.spells.length) {
      removed.push(`заклинания: ${state.spells.length - keptSpells.length}`);
      state.spells = keptSpells;
    }
    return removed;
  }
  el.cls.addEventListener('change', () => setAndUpdate({ classUrl: el.cls.value, subclassUrl: '', classSkills: [], spells: [], classEquip: 0 }));
  el.subclass.addEventListener('change', () => setAndUpdate({ subclassUrl: el.subclass.value }));
  el.species.addEventListener('change', () => setAndUpdate({ speciesUrl: el.species.value, lineageUrl: '', raceBonus: {} }));
  el.lineage.addEventListener('change', () => setAndUpdate({ lineageUrl: el.lineage.value, raceBonus: {} }));
  el.background.addEventListener('change', () => {
    const feats = { ...state.feats };
    delete feats.origin;
    setAndUpdate({ backgroundUrl: el.background.value, bgPlus2: '', bgPlus1: '', bgEquip: 0, feats });
  });
  el.armor.addEventListener('change', () => setAndUpdate({ armor: el.armor.value }));
  el.shield.addEventListener('change', () => setAndUpdate({ shield: el.shield.checked }));
  el.languages.addEventListener('change', () => setAndUpdate({ languages: el.languages.value }));
  el.notes.addEventListener('change', () => setAndUpdate({ notes: el.notes.value }));
  // Spells tab: filters re-render from the last computed sheet; picks go through update().
  const rerenderSpells = () => { if (lastComputed) renderSpells(lastComputed); };
  el.spellSearch.addEventListener('input', () => { spellFilter.search = el.spellSearch.value.trim(); rerenderSpells(); });
  el.spellsTab.addEventListener('change', event => {
    const t = event.target;
    if (t.dataset.extraList) {
      // Changing the list invalidates spells picked from the old one.
      return setAndUpdate({ extraSpells: { ...state.extraSpells, [t.dataset.extraList]: { list: t.value, picks: {} } } });
    }
    if (t.dataset.extraPick) {
      const key = t.dataset.extraPick;
      const entry = state.extraSpells[key] || {};
      const picks = { ...(entry.picks || {}) };
      const list = [...(picks[t.dataset.choice] || [])];
      list[Number(t.dataset.index)] = t.value;
      picks[t.dataset.choice] = list;
      return setAndUpdate({ extraSpells: { ...state.extraSpells, [key]: { ...entry, picks } } });
    }
    if (t.dataset.spell) {
      const set = new Set(state.spells);
      t.checked ? set.add(t.dataset.spell) : set.delete(t.dataset.spell);
      return setAndUpdate({ spells: [...set] });
    }
    if (t.dataset.filterLevel != null) {
      const lvl = Number(t.dataset.filterLevel);
      t.checked ? spellFilter.levels.add(lvl) : spellFilter.levels.delete(lvl);
    } else if (t.dataset.filterSchool != null) {
      t.checked ? spellFilter.schools.add(t.dataset.filterSchool) : spellFilter.schools.delete(t.dataset.filterSchool);
    } else if (t.name === 'filterConc') {
      spellFilter.conc = t.value;
    } else {
      const flags = { filterRitual: 'ritual', filterNoV: 'noV', filterNoS: 'noS', filterNoM: 'noM', filterChosen: 'chosen', filterAvailable: 'available' };
      if (!flags[t.id]) return;
      spellFilter[flags[t.id]] = t.checked;
    }
    rerenderSpells();
  });
  $('filterReset').addEventListener('click', () => {
    spellFilter = defaultSpellFilter();
    syncSpellFilterInputs();
    rerenderSpells();
  });
  document.addEventListener('click', event => {
    const btn = event.target.closest('[data-tab]');
    if (btn) setTab(btn.dataset.tab, { scroll: true });
  });

  document.getElementById('builder').addEventListener('change', event => {
    const t = event.target;
    if (t.name === 'abilityMethod') return setAndUpdate({ abilityMethod: t.value });
    if (t.name === 'bgMode') return setAndUpdate({ bgMode: t.value });
    if (t.dataset.bg) return setAndUpdate({ [t.dataset.bg]: t.value });
    if (t.dataset.skill) {
      const set = new Set(state.classSkills);
      t.checked ? set.add(t.dataset.skill) : set.delete(t.dataset.skill);
      return setAndUpdate({ classSkills: [...set] });
    }
    if (t.dataset.abil) {
      const method = state.abilityMethod;
      const value = Number(t.value);
      const scores = { ...state[method] };
      if (method === 'standard') {
        // Swap so the standard array stays a permutation.
        const other = ABILITIES.find(a => a.key !== t.dataset.abil && Number(scores[a.key]) === value);
        if (other) scores[other.key] = scores[t.dataset.abil];
      }
      scores[t.dataset.abil] = value;
      return setAndUpdate({ [method]: scores });
    }
    if (t.dataset.featSlot) {
      return setAndUpdate({ feats: { ...state.feats, [t.dataset.featSlot]: { url: t.value, option: 0, picks: [] } } });
    }
    if (t.dataset.featOption) {
      const key = t.dataset.featOption;
      return setAndUpdate({ feats: { ...state.feats, [key]: { ...(state.feats[key] || {}), option: Number(t.value), picks: [] } } });
    }
    if (t.dataset.racePick) {
      const index = t.dataset.racePick;
      const picks = [...(state.raceBonus[index] || [])];
      picks[Number(t.dataset.index)] = t.value;
      return setAndUpdate({ raceBonus: { ...state.raceBonus, [index]: picks } });
    }
    if (t.dataset.featPick) {
      const key = t.dataset.featPick;
      const entry = { ...(state.feats[key] || {}) };
      const picks = [...(entry.picks || [])];
      picks[Number(t.dataset.index)] = t.value;
      entry.picks = picks;
      return setAndUpdate({ feats: { ...state.feats, [key]: entry } });
    }
    if (t.dataset.spell) {
      const set = new Set(state.spells);
      t.checked ? set.add(t.dataset.spell) : set.delete(t.dataset.spell);
      return setAndUpdate({ spells: [...set] });
    }
    if (t.dataset.equip) return setAndUpdate({ [t.dataset.equip]: Number(t.value) });
  });

  document.addEventListener('click', event => {
    const t = event.target.closest('[data-action], [data-spell-info], [data-feat-info]');
    if (!t) return;
    if (t.dataset.spellInfo) { event.preventDefault(); return showSpell(t.dataset.spellInfo); }
    if (t.dataset.featInfo) { event.preventDefault(); return showFeat(t.dataset.featInfo); }
    if (t.dataset.action === 'roll') {
      const roll = () => {
        const dice = Array.from({ length: 4 }, () => 1 + Math.floor(Math.random() * 6)).sort((a, b) => a - b);
        return dice[1] + dice[2] + dice[3];
      };
      return setAndUpdate({ manual: Object.fromEntries(ABILITIES.map(a => [a.key, roll()])) });
    }
    if (t.dataset.action === 'auto-assign') return setAndUpdate({ standard: autoAssign() });
  });

  // Primary ability first, then Constitution, then the class's saving throws, then the rest.
  function autoAssign() {
    const cls = data.cls;
    const order = [];
    const push = k => { if (k && !order.includes(k)) order.push(k); };
    parseAbilityList(cls?.primaryCharacteristics).slice(0, 1).forEach(push);
    if (cls?.spellcastingAbility) push(cls.spellcastingAbility);
    push('CONSTITUTION');
    (cls?.savingThrowAbilities || []).forEach(push);
    ['DEXTERITY', 'WISDOM', 'STRENGTH', 'CHARISMA', 'INTELLIGENCE'].forEach(push);
    return Object.fromEntries(order.map((k, i) => [k, STANDARD_ARRAY[i]]));
  }

  async function showDetail(loader, renderBody) {
    el.dialogBody.innerHTML = '<p class="muted">Загрузка…</p>';
    if (!el.dialog.open) el.dialog.showModal();
    try {
      el.dialogBody.innerHTML = renderBody(await loader());
    } catch {
      el.dialogBody.innerHTML = '<p class="warn">Не удалось загрузить описание.</p>';
    }
  }
  function showSpell(url) {
    showDetail(() => P.loadSpell(url), sp => {
      const comps = sp.components || {};
      const compText = [comps.v && 'В', comps.s && 'С', comps.m && `М${typeof comps.m === 'string' ? ` (${comps.m})` : ''}`].filter(Boolean).join(', ');
      return `<h2>${esc(rus(sp))}</h2>
        <p class="hint">${sp.level ? `${sp.level} уровень` : 'Заговор'}, ${esc(sp.school || '')}${sp.ritual ? ' (ритуал)' : ''} · ${esc(sp.source?.name?.label || '')}</p>
        <dl class="kv">
          <dt>Время накладывания</dt><dd>${esc(sp.castingTime || '—')}</dd>
          <dt>Дистанция</dt><dd>${esc(sp.range || '—')}</dd>
          <dt>Компоненты</dt><dd>${esc(compText || '—')}</dd>
          <dt>Длительность</dt><dd>${esc(sp.duration || '—')}${sp.concentration && !/концентрац/i.test(sp.duration || '') ? ' (концентрация)' : ''}</dd>
        </dl><br>${rich(sp.description)}${sp.upper?.length ? `<h3>На более высоких уровнях</h3>${rich(sp.upper)}` : ''}`;
    });
  }
  function showFeat(url) {
    showDetail(() => P.loadFeat(url), f => `<h2>${esc(rus(f))}</h2>
      <p class="hint">${esc(f.category || '')}${f.prerequisite ? ` · Требование: ${esc(f.prerequisite)}` : ''} · ${esc(f.source?.name?.label || '')}</p>
      ${rich(f.description)}`);
  }

  $('newBtn').addEventListener('click', () => {
    if (!window.confirm('Создать нового персонажа? Текущий лист будет очищен (сначала можно сделать экспорт).')) return;
    state = defaultState();
    Object.keys(rendered).forEach(k => delete rendered[k]);
    fillMainSelects();
    syncStaticInputs();
    update();
  });
  $('exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ ...state, edition }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(state.name || 'персонаж').replace(/[\\/:*?"<>|]+/g, '_')}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $('importInput').addEventListener('change', async event => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text());
      // Exports before the edition switch carry no edition and are 2024 characters.
      const target = raw.edition === '2014' ? '2014' : '2024';
      if (target !== edition) await switchEdition(target, { skipUpdate: true });
      delete raw.edition;
      state = normalizeState(raw);
      Object.keys(rendered).forEach(k => delete rendered[k]);
      fillMainSelects();
      syncStaticInputs();
      update();
    } catch {
      setStatus('Файл не похож на сохранённого персонажа', true);
    }
  });
  $('printBtn').addEventListener('click', () => window.print());

  document.querySelectorAll('input[name="edition"]').forEach(radio => radio.addEventListener('change', () => {
    if (radio.checked) switchEdition(radio.value);
  }));

  // ---------- editions ----------

  const editionLists = {}; // edition -> loaded lists, so switching back is instant

  async function loadEditionLists() {
    if (!editionLists[edition]) {
      try {
        editionLists[edition] = await P.loadLists();
      } catch (err) {
        console.error(err);
        setStatus('TTG Club недоступен — попробуйте позже', true);
        return;
      }
    }
    Object.assign(lists, { feats: [], sourceList: [] }, editionLists[edition]);
  }

  async function switchEdition(next, { skipUpdate = false } = {}) {
    if (next === edition || !PROVIDERS[next]) return;
    save(); // keep the current edition's character
    generation++; // drop any in-flight update for the old edition
    edition = next;
    P = PROVIDERS[edition];
    state = loadState(edition);
    Object.assign(data, {
      cls: null, subclasses: [], subclass: null, eff: null, species: null, lineages: [], lineage: null,
      background: null, feats: {}, featLists: { general: [], epic: [] }, spells: [], spellsKey: '', granted: [],
      spellSources: [], spellCandidates: {},
    });
    Object.keys(rendered).forEach(k => delete rendered[k]);
    spellFilter = defaultSpellFilter();
    syncSpellFilterInputs();
    setStatus('Загрузка…');
    syncStaticInputs();
    await loadEditionLists();
    syncStaticInputs();
    fillMainSelects();
    if (!skipUpdate) update();
  }

  // ---------- init ----------

  async function init() {
    el.armor.innerHTML = ARMORS.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('');
    syncStaticInputs();
    let tab = 'builder';
    try { tab = localStorage.getItem(TAB_KEY) === 'spells' ? 'spells' : 'builder'; } catch { /* storage blocked */ }
    setTab(tab);
    // Damage/condition names are the same in both editions; take them from the core-api.
    const [damage, conditions] = await Promise.all([
      fetchJson('/api/dnd/dictionaries/damage/types', () => coreDirect('dictionaries/damage/types')).catch(() => []),
      fetchJson('/api/dnd/dictionaries/conditions', () => coreDirect('dictionaries/conditions')).catch(() => []),
      loadEditionLists(),
    ]);
    const toDict = arr => Object.fromEntries((Array.isArray(arr) ? arr : []).map(x => [x.value, (x.label || x.name || '').toLowerCase()]));
    lists.damage = toDict(damage);
    lists.conditions = toDict(conditions);
    syncStaticInputs();
    fillMainSelects();
    update();
  }

  init();
})();
