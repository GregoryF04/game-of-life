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
      choices: {}, // feature options, expertise, skills, tools, languages: { [choiceKey]: [value, ...] }
      optionalFeatures: {}, // 2014 TCE optional class features turned on: { "main:c52": true }
      extraSpells: {}, // racial/feat spell choices: { [sourceKey]: { list, picks: { [choiceKey]: [url, ...] } } }
      classSkills: [],
      // Extra classes: [{ classUrl, subclassUrl, level, spells: [url, …] }]. The fields above
      // (classUrl, subclassUrl, level, spells) are the main class; character level is the sum.
      multiclass: [],
      // HP: 'average' | 'rolled' (hpRolls["main:2"] = die result) | 'manual' (hpManual total).
      hpMode: 'average', hpRolls: {}, hpManual: null,
      feats: {},
      spells: [],
      armor: 'none', shield: false,
      classEquip: 0, bgEquip: 0,
      weapons: [], // weapon keys from weapons.js shown in the attacks section
      inventory: [], // [{ name, qty }]
      money: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
      equip14: {}, // 2014 starting equipment: { [line index]: chosen option index }
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
    if (!s.choices || typeof s.choices !== 'object') s.choices = {};
    if (!s.optionalFeatures || typeof s.optionalFeatures !== 'object') s.optionalFeatures = {};
    if (!['average', 'rolled', 'manual'].includes(s.hpMode)) s.hpMode = 'average';
    s.weapons = Array.isArray(s.weapons) ? s.weapons.filter(k => typeof k === 'string') : [];
    s.inventory = (Array.isArray(s.inventory) ? s.inventory : [])
      .map(x => ({ name: String(x?.name || '').slice(0, 120), qty: clampInt(x?.qty, 0, 9999, 1) }));
    s.money = Object.fromEntries(['cp', 'sp', 'ep', 'gp', 'pp'].map(k => [k, clampInt(raw.money?.[k], 0, 9999999, 0)]));
    if (!s.equip14 || typeof s.equip14 !== 'object') s.equip14 = {};
    if (!s.hpRolls || typeof s.hpRolls !== 'object') s.hpRolls = {};
    s.multiclass = (Array.isArray(s.multiclass) ? s.multiclass : []).slice(0, 3).map(m => ({
      classUrl: String(m?.classUrl || ''), subclassUrl: String(m?.subclassUrl || ''),
      level: clampInt(m?.level, 1, 19, 1), spells: Array.isArray(m?.spells) ? m.spells : [],
    }));
    // Older saves had a single officialOnly flag. Keep their behaviour: filter on → default
    // book set; filter off → all books ('*'), so nothing gets dropped from them on load.
    s.sources = Array.isArray(raw.sources) ? raw.sources.filter(x => typeof x === 'string')
      : raw.officialOnly ? [...DEFAULT_SOURCES] : ['*'];
    delete s.officialOnly;
    return s;
  }

  let edition = '2014';
  try { if (localStorage.getItem(EDITION_KEY) === '2024') edition = '2024'; } catch { /* storage blocked */ }

  // ---------- roster: several saved characters per edition ----------
  // { 2014: { active: id, items: { [id]: { state, updatedAt } } }, 2024: { … } }.
  // Older versions kept one character per edition under STORAGE_KEYS; it becomes the first entry.
  const ROSTER_KEY = 'mg-dnd-roster-v1';
  const newId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  function loadRoster() {
    let roster = null;
    try { roster = JSON.parse(localStorage.getItem(ROSTER_KEY)); } catch { /* storage blocked */ }
    if (!roster || typeof roster !== 'object') roster = {};
    for (const ed of ['2014', '2024']) {
      if (roster[ed]?.items && Object.keys(roster[ed].items).length) continue;
      let legacy = null;
      try { legacy = JSON.parse(localStorage.getItem(STORAGE_KEYS[ed])); } catch { /* none */ }
      const id = newId();
      roster[ed] = { active: id, items: { [id]: { state: normalizeState(legacy), updatedAt: Date.now() } } };
    }
    for (const ed of ['2014', '2024']) {
      if (!roster[ed].items[roster[ed].active]) roster[ed].active = Object.keys(roster[ed].items)[0];
    }
    return roster;
  }
  const roster = loadRoster();

  function loadState(ed) {
    return normalizeState(roster[ed].items[roster[ed].active]?.state);
  }
  let state = loadState(edition);

  function save() {
    roster[edition].items[roster[edition].active] = { state, updatedAt: Date.now() };
    try {
      localStorage.setItem(ROSTER_KEY, JSON.stringify(roster));
      localStorage.setItem(EDITION_KEY, edition);
    } catch { /* storage blocked */ }
  }

  // Short label for the roster selector: name, class and level.
  function rosterLabel(s) {
    const cls = lists.classes?.find(x => x.url === s.classUrl);
    const level = (s.level || 1) + (s.multiclass || []).reduce((n, m) => n + (m.classUrl ? m.level || 0 : 0), 0);
    return `${s.name || 'Безымянный герой'}${cls ? ` — ${rus(cls)}` : ''}, ${level} ур.`;
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

  // 2014 list entries lack ritual/concentration; take them from the server's flag index.
  function spellShort14(raw) {
    const s = T14.normalizeSpellShort(raw);
    const f = lists.spellFlags?.[s.url];
    return f ? { ...s, ritual: Boolean(f.r), concentration: Boolean(f.c) } : s;
  }

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
      // { CATEGORY: [feat, …] } for the categories the feat slots need.
      async featLists(categories) {
        const out = {};
        await Promise.all(categories.map(async cat => {
          out[cat] = sortByName(await api(`feats/search?category=${cat}`).catch(() => []));
        }));
        return out;
      },
      loadFeat: url => api(`feats/${url}`),
      loadOption: async () => null, // 2024 options carry their description inline
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
        // Elven Lineage / Fiendish Legacy (PHB 2024): cantrip at level 1, 1st-level spell at 3,
        // 2nd-level spell at 5. TTG's Infernal tiefling lists all three at level 1.
        const legacyLevel = (key, g) => (key === 'lineage' && /^(elf|tiefling)-phb$/.test(species?.url || '')
          ? Math.max(g.requiredLevel || 1, [1, 3, 5][g.spell.level] || 1) : g.requiredLevel || 1);
        for (const [key, race] of [['species', species], ['lineage', lineage]]) {
          if (!race?.innateSpells?.length) continue;
          sources.push({
            key, title: rus(race), tag: 'раса', choices: [], listOptions: null,
            fixed: race.innateSpells.filter(g => g.spell?.url).map(g => ({ url: g.spell.url, spell: g.spell, level: legacyLevel(key, g) })),
            // The casting ability is a choice on the species or its lineage (elf "Происхождения эльфов").
            choicePrefixes: [species && `race:${species.url}`, lineage && `race:${lineage.url}`].filter(Boolean),
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
          sources.push({
            key: `feat:${slot.key}`, title: rus(feat), tag: 'черта', fixed, choices, listOptions, defaultList,
            slotKey: slot.key, choicePrefixes: [`feat:${slot.key}`], ability: listOptions ? 'fromList' : 'fromBonus',
          });
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
        const [classes, races, backgrounds, feats, spellFlags] = await Promise.all([
          api('classes'), api('races'), api('backgrounds'), api('traits').catch(() => []),
          api('spell-flags').catch(() => ({})),
        ]);
        const out = {
          spellFlags: spellFlags && typeof spellFlags === 'object' ? spellFlags : {},
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
      // The legacy API has no feat categories: every slot offers every feat.
      featLists: async categories => Object.fromEntries(categories.map(cat => [cat, cat === 'GENERAL' ? lists.feats || [] : []])),
      async loadOption(url) { return T14.normalizeOption(await api(`options/${url}`), url); },
      async loadFeat(url) { return T14.normalizeFeat(await api(`traits/${url}`), url); },
      spellListKey({ eff }) {
        if (!eff || !isCasterType(eff.casterType) || !eff.spellListClassId) return '';
        return `spells?class=${eff.spellListClassId}`;
      },
      loadSpells: async key => sortByName((await api(key)).map(spellShort14)),
      async loadSpell(url) { return T14.normalizeSpell(await api(`spells/${url}`)); },
      // Subclass spell table: rows by class level, always prepared. The warlock table lists
      // spells by spell level and only widens the choice, so all rows apply.
      async grantedSpells(eff, level, classSpells = []) {
        const mode = eff?.expandedList ? 'expanded' : 'always';
        const rows = (eff?.subclassSpells || []).filter(row => mode === 'expanded' || row.level <= level);
        const items = rows.flatMap(row => row.spells.map(s => ({ ...s, level: row.level })));
        const resolved = await Promise.all(items.map(async item => {
          const spell = classSpells.find(x => x.url === item.url)
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
            key, title, tag: entry.ritualBook ? 'ритуальная книга' : tag,
            fixed: (entry.fixed || []).map(([url, level]) => ({ url, level })),
            choices: (entry.choices || []).map(ch => ({ ...ch, schools: ch.schools || [], ritual: Boolean(ch.ritual) })),
            listOptions: entry.listOptions ? entry.listOptions.map(v => ({ value: v, label: T14.CLASS_NAMES[v] || v })) : null,
            defaultList: '',
            ability: entry.ability || null,
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
        for (const s of lists14.flat().map(spellShort14)) if (s.level === level && !byUrl.has(s.url)) byUrl.set(s.url, s);
        return sortByName([...byUrl.values()]);
      },
    },
  };
  let P = PROVIDERS[edition];

  const lists = { sources: [], sourceList: [], classes: [], species: [], backgrounds: [], feats: [], skills: FALLBACK_SKILLS, damage: {}, conditions: {} };
  const data = {
    cls: null, subclasses: [], subclass: null, eff: null,
    species: null, lineages: [], lineage: null,
    background: null, feats: {}, featLists: {},
    entries: [], spells: [], spellsKey: '', granted: [], spellSources: [], spellCandidates: {},
  };

  // ---------- classes (main + multiclass) ----------

  // Class entries from state: the main class first, then extra classes that have a class set.
  function classEntriesFromState() {
    return [
      { key: 'main', prefix: '', classUrl: state.classUrl, subclassUrl: state.subclassUrl, level: state.level },
      ...state.multiclass.map((m, i) => ({ key: `mc${i}`, prefix: `mc${i}:`, index: i, classUrl: m.classUrl, subclassUrl: m.subclassUrl, level: m.level }))
        .filter(e => e.classUrl),
    ];
  }
  // Character level: all class levels together (proficiency bonus, HP, racial spells, …).
  const charLevel = () => Math.min(20, classEntriesFromState().reduce((n, e) => n + e.level, 0));
  // Spell picks of one class entry.
  const spellPicksOf = key => (key === 'main' ? state.spells : state.multiclass[Number(key.slice(2))]?.spells || []);
  function setSpellPicks(key, spells) {
    if (key === 'main') return setAndUpdate({ spells });
    const multiclass = state.multiclass.map((m, i) => (`mc${i}` === key ? { ...m, spells } : m));
    return setAndUpdate({ multiclass });
  }

  // Circle of the Land: spells depend on a terrain the druid picks, which neither API has in a
  // usable form. Rows are [druid level, [spell slugs]] (PHB 2014 / PHB 2024).
  const LAND_CIRCLE = {
    2014: {
      'druid/land': {
        level: 2,
        terrains: {
          arctic: ['Арктика', [[3, ['hold_person', 'spike_growth']], [5, ['sleet_storm', 'slow']], [7, ['freedom_of_movement', 'ice_storm']], [9, ['commune_with_nature', 'cone_of_cold']]]],
          coast: ['Побережье', [[3, ['mirror_image', 'misty_step']], [5, ['water_breathing', 'water_walk']], [7, ['control_water', 'freedom_of_movement']], [9, ['conjure_elemental', 'scrying']]]],
          desert: ['Пустыня', [[3, ['blur', 'silence']], [5, ['create_food_and_water', 'protection_from_energy']], [7, ['blight', 'hallucinatory_terrain']], [9, ['insect_plague', 'wall_of_stone']]]],
          forest: ['Лес', [[3, ['barkskin', 'spider_climb']], [5, ['call_lightning', 'plant_growth']], [7, ['divination', 'freedom_of_movement']], [9, ['commune_with_nature', 'tree_stride']]]],
          grassland: ['Луга', [[3, ['invisibility', 'pass_without_trace']], [5, ['daylight', 'haste']], [7, ['divination', 'freedom_of_movement']], [9, ['dream', 'insect_plague']]]],
          mountain: ['Горы', [[3, ['spider_climb', 'spike_growth']], [5, ['lightning_bolt', 'meld_into_stone']], [7, ['stone_shape', 'stoneskin']], [9, ['passwall', 'wall_of_stone']]]],
          swamp: ['Болото', [[3, ["melf's_acid_arrow", 'darkness']], [5, ['water_walk', 'stinking_cloud']], [7, ['freedom_of_movement', 'locate_creature']], [9, ['insect_plague', 'scrying']]]],
          underdark: ['Подземье', [[3, ['spider_climb', 'web']], [5, ['gaseous_form', 'stinking_cloud']], [7, ['greater_invisibility', 'stone_shape']], [9, ['cloudkill', 'insect_plague']]]],
        },
      },
    },
    2024: {
      'circle-of-the-land-phb': {
        level: 3,
        terrains: {
          arid: ['Засушливая земля', [[3, ['blur-phb', 'burning-hands-phb', 'fire-bolt-phb']], [5, ['fireball-phb']], [7, ['blight-phb']], [9, ['wall-of-stone-phb']]]],
          polar: ['Полярная земля', [[3, ['fog-cloud-phb', 'hold-person-phb', 'ray-of-frost-phb']], [5, ['sleet-storm-phb']], [7, ['ice-storm-phb']], [9, ['cone-of-cold-phb']]]],
          temperate: ['Умеренная земля', [[3, ['misty-step-phb', 'shocking-grasp-phb', 'sleep-phb']], [5, ['lightning-bolt-phb']], [7, ['freedom-of-movement-phb']], [9, ['tree-stride-phb']]]],
          tropical: ['Тропическая земля', [[3, ['acid-splash-phb', 'ray-of-sickness-phb', 'web-phb']], [5, ['stinking-cloud-phb']], [7, ['polymorph-phb']], [9, ['insect-plague-phb']]]],
        },
      },
    },
  };

  // Adds the terrain choice to a Land druid and returns the terrain's always-prepared spells.
  async function applyLandCircle(entry, eff, spells) {
    const land = LAND_CIRCLE[edition]?.[entry.subclassUrl];
    if (!land || !eff) return { eff, granted: [] };
    const nameOf = url => rus(spells.find(x => x.url === url)) || url.replace(/[_-]phb$|_/g, ' ').trim();
    const feature = {
      key: 'land-terrain', name: 'Земля круга', level: land.level, scaling: [], mechanics: null, isSubclass: true,
      description: ['Выберите местность: её заклинания круга всегда подготовлены и не учитываются в лимите.'],
      options: Object.entries(land.terrains).map(([key, [name, rows]]) => ({
        key, url: key, name: { rus: name },
        description: rows.map(([lvl, urls]) => `{@b ${lvl} ур.:} ${urls.map(nameOf).join(', ')}`),
      })),
      optionsChoice: { label: 'Местность', count: 1, scaling: [] },
    };
    const withChoice = { ...eff, features: [...(eff.features || []), feature] };
    const terrain = land.terrains[(state.choices[`${entry.prefix}opt:land-terrain`] || [])[0]];
    if (!terrain || entry.level < land.level) return { eff: withChoice, granted: [] };
    const items = terrain[1].filter(([lvl]) => lvl <= entry.level).flatMap(([lvl, urls]) => urls.map(url => ({ url, lvl })));
    const granted = (await Promise.all(items.map(async ({ url, lvl }) => {
      const spell = spells.find(x => x.url === url) || await P.loadSpell(url).catch(() => null);
      return spell ? { spell, level: lvl, mode: 'always', from: `Круг земли: ${terrain[0]}` } : null;
    }))).filter(Boolean);
    return { eff: withChoice, granted };
  }

  // Loads one class with its subclass (if unlocked), spell list and granted spells.
  async function loadClassEntry(entry) {
    const cls = entry.classUrl ? await P.loadClass(entry.classUrl) : null;
    const subclasses = cls ? await P.subclasses(cls) : [];
    const open = cls && entry.subclassUrl && entry.level >= (cls.subclassLevel || 3)
      && subclasses.some(x => x.url === entry.subclassUrl);
    const subclass = open ? await P.loadSubclass(entry.subclassUrl) : null;
    // Subclass detail already merges the parent's features and carries its own casting table.
    let eff = subclass || cls;
    const spellsKey = eff ? P.spellListKey({ cls, subclass, eff }) : '';
    const spells = spellsKey ? await P.loadSpells(spellsKey) : [];
    const granted = spellsKey ? await P.grantedSpells(eff, entry.level, spells).catch(() => []) : [];
    if (subclass) {
      const land = await applyLandCircle(entry, eff, spells);
      eff = land.eff;
      granted.push(...land.granted.filter(g => !granted.some(x => x.spell.url === g.spell.url)));
    }
    // Spells of turned-on TCE optional features (e.g. ranger Primal Awareness), by class level.
    if (spellsKey && eff) {
      const active = featureFilter({ ...entry, eff });
      const rows = (eff.features || []).filter(f => f.grantSpells && f.optional && active(f))
        .flatMap(f => f.grantSpells.filter(([, lvl]) => lvl <= entry.level).map(([url, lvl]) => ({ url, lvl, from: f.name })));
      for (const row of rows) {
        if (granted.some(x => x.spell.url === row.url)) continue;
        const spell = spells.find(x => x.url === row.url) || await P.loadSpell(row.url).catch(() => null);
        if (spell) granted.push({ spell, level: row.lvl, mode: 'always', from: row.from });
      }
    }
    return { ...entry, cls, subclasses: Array.isArray(subclasses) ? subclasses : [], subclass, eff, spells, spellsKey, granted };
  }

  async function loadData() {
    const s = state;
    const speciesShort = lists.species.find(x => x.url === s.speciesUrl);
    const [entries, species, lineages, background] = await Promise.all([
      Promise.all(classEntriesFromState().map(loadClassEntry)),
      s.speciesUrl ? P.loadSpecies(s.speciesUrl) : null,
      speciesShort ? P.lineages(speciesShort) : [],
      s.backgroundUrl ? P.loadBackground(s.backgroundUrl) : null,
    ]);
    data.entries = entries;
    const main = entries[0];
    data.cls = main.cls;
    data.subclasses = main.subclasses;
    data.subclass = main.subclass;
    data.eff = main.eff;
    data.species = species;
    data.lineages = Array.isArray(lineages) ? lineages : [];
    data.lineage = s.lineageUrl && data.lineages.some(x => x.url === s.lineageUrl)
      ? await P.loadLineage(s.lineageUrl, data.lineages) : null;
    data.background = background;

    const slots = featSlots();
    const featUrls = [...new Set(slots.map(slot => slotFeatUrl(slot)).filter(url => url && url !== ASI_FEAT.url))];
    const categories = [...new Set(slots.filter(x => !x.fixed).flatMap(x => x.categories || []))];
    const [featLists, ...featDetails] = await Promise.all([
      categories.length ? P.featLists(categories) : {},
      ...featUrls.map(url => P.loadFeat(url).catch(() => null)),
    ]);
    data.featLists = featLists;
    data.feats = { [ASI_FEAT.url]: ASI_FEAT };
    featUrls.forEach((url, i) => { if (featDetails[i]) data.feats[url] = featDetails[i]; });

    // Main-class spell data stays on data.* for the parts that only care about one class.
    data.spells = main.spells;
    data.spellsKey = main.spellsKey;
    data.granted = main.granted;
    await loadSpellSources(slots);
  }

  // Racial and feat spells: fixed grants plus choices from a class list.
  async function loadSpellSources(slots) {
    const feats = slots.map(slot => ({ slot, feat: data.feats[slotFeatUrl(slot)] }))
      .filter(x => x.feat && x.feat.url !== ASI_FEAT.url);
    const pb = 2 + Math.floor((charLevel() - 1) / 4);
    const sources = P.spellSources({ species: data.species, lineage: data.lineage, feats, pb, background: data.background });
    // Picked feature options may grant spells (e.g. 2024 invocations).
    for (const ch of collectChoices().filter(x => x.type === 'option')) {
      for (const opt of pickedOptions(ch)) {
        const fixed = (opt.grantedSpells || []).filter(g => g.spell?.url)
          .map(g => ({ url: g.spell.url, spell: g.spell, level: g.requiredLevel || 1 }));
        if (fixed.length) sources.push({ key: `opt:${ch.key}:${opt.key}`, title: rus(opt), tag: 'умение', fixed, choices: [], listOptions: null });
      }
    }
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
        if (f.spell && f.level <= charLevel() && !out.has(f.spell.url)) {
          out.set(f.spell.url, { ...f.spell, alwaysFrom: src.title, sourceTag: src.tag, sourceKey: src.key, grantedAt: f.level });
        }
      }
      for (const ch of src.choices) {
        const cands = data.spellCandidates?.[`${src.key}:${ch.key}`] || [];
        const picked = [];
        for (const url of state.extraSpells[src.key]?.picks?.[ch.key] || []) {
          const spell = cands.find(x => x.url === url);
          if (!spell || picked.includes(url) || picked.length >= ch.count) continue;
          picked.push(url);
          if (!out.has(url)) out.set(url, { ...spell, alwaysFrom: src.title, sourceTag: src.tag, sourceKey: src.key });
        }
      }
    }
    return [...out.values()];
  }

  // Spells the player can pick for a class: its list plus a warlock's expanded patron list.
  function spellPool(entry = classEntriesLoaded()[0]) {
    const list = entry?.spells || [];
    const extra = (entry?.granted || []).filter(g => g.mode === 'expanded' && !list.some(x => x.url === g.spell.url))
      .map(g => ({ ...g.spell, expanded: true }));
    return extra.length ? sortByName([...list, ...extra]) : list;
  }
  const alwaysPrepared = (entry = classEntriesLoaded()[0]) => (entry?.granted || []).filter(g => g.mode === 'always');

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

  const FEAT_CATEGORY_NAMES = {
    GENERAL: 'Общие черты', EPIC_BOON: 'Эпические черты', ORIGIN: 'Черты происхождения', FIGHTING_STYLE: 'Боевые стили',
  };
  // Choices that pick a feat of some category: 2024 fighting styles, the human's Versatile.
  const ASI_CHOICE_KEYS = new Set(['feat', 'epic-boon']);

  function featSlots() {
    const slots = [];
    // 2014: a race trait named «Черта» (variant human) grants a free feat at level 1.
    if (data.lineage?.grantsFeat || data.species?.grantsFeat) {
      slots.push({ key: 'race', level: 1, title: `Черта расы (${rus(data.lineage || data.species)})`, categories: ['GENERAL'] });
    }
    // 2024 species features that grant a feat (human Versatile → origin feat).
    for (const race of [data.species, data.lineage]) {
      for (const f of race?.features || []) {
        for (const ch of f.mechanics?.choices || []) {
          if (ch.type !== 'FEAT') continue;
          slots.push({ key: `sp:${race.url}:${ch.key}`, level: 1, title: `${rus(f)} (${rus(race)})`, categories: ch.featCategories?.length ? ch.featCategories : ['ORIGIN'] });
        }
      }
    }
    if (P.rules.originFeat && state.backgroundUrl) {
      const short = lists.backgrounds.find(b => b.url === state.backgroundUrl);
      const fixed = short?.featUrl || featUrlFromMarkup(data.background?.feat);
      if (fixed) slots.push({ key: 'origin', level: 1, title: 'Черта предыстории', fixed });
    }
    const seen = new Set();
    // Every class gives its own ASI / feat slots by its own class level. The main class keeps
    // the original keys ("lvl4"); extra classes are prefixed ("mc0:lvl4").
    for (const entry of classEntriesLoaded()) {
      const multi = data.entries.length > 1;
      const tag = multi ? ` (${rus(entry.cls)})` : '';
      for (const f of expandFeatures(entry.eff?.features)) {
        if (f.level > entry.level) continue;
        // Class features that pick a feat of a category (2024 fighting style), not the ASI ones.
        // (Scaling copies from expandFeatures carry no mechanics, so each choice appears once.)
        for (const ch of f.mechanics?.choices || []) {
          if (ch.type !== 'FEAT' || ASI_CHOICE_KEYS.has(ch.key)) continue;
          const key = `${entry.prefix}cf:${f.key || f.name}:${ch.key}`;
          if (seen.has(key)) continue;
          seen.add(key);
          slots.push({ key, level: f.level, title: `${f.name} · ${f.level} ур.${tag}`, categories: ch.featCategories || ['GENERAL'] });
        }
        const epic = /эпическ\S* черт/i.test(f.name || '');
        if (!f.abilityImprovement && !epic) continue;
        let key = `${entry.prefix}lvl${f.level}`;
        while (seen.has(key)) key += 'b';
        seen.add(key);
        // 2014: the slot is "ASI or a feat" and defaults to the ASI.
        slots.push({
          key, level: f.level, title: `${f.name} · ${f.level} ур.${tag}`, epic, asi: P.rules.asiPseudoFeat,
          categories: epic ? ['EPIC_BOON', 'GENERAL'] : ['GENERAL'],
        });
      }
    }
    return slots;
  }

  // TCE optional class features (2014): off by default. A feature that is on hides the one it
  // replaces (and that one's later improvements); Deft Explorer's parts follow Deft Explorer.
  const optionalKey = (entry, f) => `${entry.key}:${f.featureId}`;
  function optionalParent(entry, f) {
    return f.optionalGroup ? (entry.eff?.features || []).find(g => g.optional && g.name === f.optionalGroup) || null : null;
  }
  function featureFilter(entry) {
    const features = entry.eff?.features || [];
    const on = f => Boolean(state.optionalFeatures[optionalKey(entry, optionalParent(entry, f) || f)]);
    const enabled = features.filter(f => f.optional && on(f) && f.level <= entry.level);
    const ids = new Set(enabled.flatMap(f => f.replaces?.ids || []));
    const names = new Set(enabled.flatMap(f => f.replaces?.names || []));
    return f => (f.optional ? on(f) : !(ids.has(f.featureId) || names.has(f.name)));
  }

  // Loaded class entries; before the first load, the main class from data.*.
  function classEntriesLoaded() {
    if (data.entries?.length) return data.entries;
    return [{ key: 'main', prefix: '', level: state.level, cls: data.cls, eff: data.eff, subclass: data.subclass, subclasses: data.subclasses, spells: data.spells, granted: data.granted }];
  }
  function slotFeatUrl(slot) {
    if (slot.fixed) return slot.fixed;
    const picked = state.feats[slot.key];
    if (picked && typeof picked.url === 'string' && (picked.url || !slot.asi)) return picked.url;
    return slot.asi ? ASI_FEAT.url : '';
  }

  // ---------- choices: feature options, expertise, skills, tools, languages, casting ability ----------

  // Count for a choice at the current level: the last scaling step reached, else its count.
  function scaledCount(choice, level) {
    if (!choice) return 0;
    const steps = (choice.scaling || []).filter(s => s.level <= level);
    if (choice.scaling?.length) return steps.length ? steps[steps.length - 1].count : 0;
    return choice.count || 1;
  }

  // Every choice the character currently has, from class features, race/subrace and feats.
  // key is stable across renders and is where the picks live (state.choices[key]).
  function collectChoices() {
    const out = [];
    // L: the level that gates and scales this choice (class level for class features,
    // character level for race and feats).
    const fromMechanics = (prefix, title, mechanics, level, L) => {
      for (const ch of mechanics?.choices || []) {
        if (ch.requiredLevel && ch.requiredLevel > L) continue;
        const count = scaledCount(ch, L);
        if (!count) continue;
        const key = `${prefix}:${ch.key}`;
        const base = { key, title, label: ch.label || title, count, level, classLevel: L };
        if (ch.type === 'SKILL') {
          out.push({
            ...base, type: ch.grants === 'EXPERTISE' ? 'expertise' : 'skill',
            options: (ch.options || []).map(o => o.value).filter(Boolean), onlyIfNotProficient: Boolean(ch.onlyIfNotProficient),
            allowTools: ch.allowTools || [],
          });
        } else if (ch.type === 'LANGUAGE') {
          out.push({ ...base, type: 'language' });
        } else if (ch.type === 'TOOL') {
          out.push({ ...base, type: 'tool', options: (ch.options || []).map(o => ({ value: o.value, label: o.name || o.value })) });
        } else if (ch.type === 'SPELLCASTING_ABILITY') {
          out.push({ ...base, type: 'ability', options: (ch.options || []).map(o => o.value).filter(v => ABILITY[v]) });
        } else if (ch.type === 'WEAPON_MASTERY') {
          out.push({ ...base, type: 'mastery' }); // options: proficient weapons, resolved in compute
        }
        // FEAT → feat slots; CANTRIP/SPELL → spells.
      }
    };
    const entries = classEntriesLoaded();
    for (const entry of entries) {
      const L = entry.level;
      const tag = entries.length > 1 ? ` (${rus(entry.cls)})` : '';
      const active = featureFilter(entry);
      for (const f of entry.eff?.features || []) {
        if (f.level > L || (entry.subclass && f.hideInSubclasses) || !active(f)) continue;
        if (f.options?.length && f.optionsChoice) {
          const count = scaledCount(f.optionsChoice, L);
          if (count) {
            out.push({
              key: `${entry.prefix}opt:${f.key || f.name}`, type: 'option', title: f.name + tag,
              label: f.optionsChoice.label || f.optionsName || f.name, count, level: f.level, classLevel: L, options: f.options,
            });
          }
        }
        fromMechanics(`${entry.prefix}cls:${f.key || f.name}`, f.name + tag, f.mechanics, f.level, L);
      }
      // Multiclassing into bard, ranger or rogue grants one skill from the class list.
      const mcSkill = entry.key !== 'main' && MULTICLASS_SKILL[baseClass(entry.cls)];
      if (mcSkill) {
        out.push({
          key: `${entry.prefix}mc-skill`, type: 'skill', title: `Мультикласс: ${rus(entry.cls)}`, label: 'Навык класса',
          count: 1, level: 1, classLevel: L,
          options: mcSkill === 'any' ? [] : entry.cls?.proficiency?.skillData?.skills || [], onlyIfNotProficient: true,
        });
      }
    }
    const CL = charLevel();
    for (const race of [data.species, data.lineage]) {
      if (!race) continue;
      fromMechanics(`race:${race.url}`, rus(race), race.mechanics, 1, CL);
      for (const f of race.features || []) fromMechanics(`race:${race.url}:${rus(f)}`, `${rus(f)} (${rus(race)})`, f.mechanics, f.level || 1, CL);
    }
    for (const slot of featSlots()) {
      const feat = data.feats[slotFeatUrl(slot)];
      if (feat && feat.url !== ASI_FEAT.url) fromMechanics(`feat:${slot.key}`, rus(feat), feat.mechanics, slot.level, CL);
    }
    return out;
  }

  // Class identity without the edition/book suffix: "fighter-phb" / "fighter" → "fighter".
  const baseClass = cls => String(cls?.parent?.url || cls?.url || '').split('/')[0].replace(/-[a-z0-9]+$/, '');

  // Multiclassing rules (PHB, same in 2014 and 2024): requirements, armor gained, extra skill.
  const MULTICLASS_REQ = {
    barbarian: [['STRENGTH']], bard: [['CHARISMA']], cleric: [['WISDOM']], druid: [['WISDOM']],
    fighter: [['STRENGTH', 'DEXTERITY']], monk: [['DEXTERITY'], ['WISDOM']], paladin: [['STRENGTH'], ['CHARISMA']],
    ranger: [['DEXTERITY'], ['WISDOM']], rogue: [['DEXTERITY']], sorcerer: [['CHARISMA']], warlock: [['CHARISMA']],
    wizard: [['INTELLIGENCE']], artificer: [['INTELLIGENCE']],
  };
  const MULTICLASS_ARMOR = {
    barbarian: ['SHIELD'], bard: ['LIGHT'], cleric: ['LIGHT', 'MEDIUM', 'SHIELD'], druid: ['LIGHT', 'MEDIUM', 'SHIELD'],
    fighter: ['LIGHT', 'MEDIUM', 'SHIELD'], paladin: ['LIGHT', 'MEDIUM', 'SHIELD'], ranger: ['LIGHT', 'MEDIUM', 'SHIELD'],
    rogue: ['LIGHT'], warlock: ['LIGHT'], artificer: ['LIGHT', 'MEDIUM', 'SHIELD'],
  };
  const MULTICLASS_SKILL = { bard: 'any', ranger: 'list', rogue: 'list' };

  // The player's picks for a choice, deduplicated and capped at its count.
  function choicePicks(choice, valid = () => true) {
    const picks = [];
    for (const v of state.choices[choice.key] || []) {
      if (v && !picks.includes(v) && valid(v) && picks.length < choice.count) picks.push(v);
    }
    return picks;
  }

  // Options picked for an option-type choice (invocations, metamagic, maneuvers, …).
  // Options below their required class level are ignored until the character gets there.
  function pickedOptions(choice) {
    const allowed = o => o && !(o.requiredClassLevel && o.requiredClassLevel > (choice.classLevel || state.level));
    return choicePicks(choice, v => allowed(choice.options.find(o => o.key === v)))
      .map(v => choice.options.find(o => o.key === v));
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
    const L = s.level; // main class level
    const CL = charLevel(); // character level (all classes)
    const entries = classEntriesLoaded();
    const multi = entries.length > 1;
    const { cls, eff, species, lineage, background } = data;
    const pb = 2 + Math.floor((CL - 1) / 4);

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
      initPB: false, initBonus: 0, passiveBonus: 0, speedBonus: 0, equalsWalk: new Set(), skills: new Set(), saves: new Set(), counters: [],
    };
    // classLevel: level of the class the mechanics come from (counters scale with it);
    // race and feat mechanics use the character level.
    const addMech = (m, acquired, from, classLevel = CL) => {
      if (!m) return;
      const mo = m.modifiers || {};
      if (mo.hitPoints && (mo.hitPoints.perAcquisitionLevel || mo.hitPoints.perLevelAfterAcquisition)) {
        // "perAcquisitionLevel" is per character level at the moment the trait is gained
        // (Tough at level 4 gives +8 at once), then "perLevelAfterAcquisition" for each later level.
        const gained = Math.min(acquired, CL);
        mech.hp += (mo.hitPoints.perAcquisitionLevel || 0) * gained + (mo.hitPoints.perLevelAfterAcquisition || 0) * Math.max(0, CL - gained);
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
      // Speed bonuses and "climb/swim/fly speed equals walking speed" (TCE Roving; 2024 data's speed flags).
      mech.speedBonus += Number(mo.speedBonus) || 0;
      for (const kind of ['climb', 'swim', 'fly']) if (mo[`${kind}EqualsWalk`] || mo.speed?.[`${kind}EqualsWalk`]) mech.equalsWalk.add(kind);
      const prof = m.proficiencies || {};
      (prof.skills || []).forEach(x => typeof x === 'string' && mech.skills.add(x));
      (prof.savingThrows || []).forEach(x => typeof x === 'string' && mech.saves.add(x));
      (m.counters || []).forEach(c => mech.counters.push({ ...c, from, classLevel }));
    };

    // Features of every class up to that class's level, tagged with the class when multiclassed.
    const classFeatures = [];
    for (const entry of entries) {
      if (entry.eff) addMech(entry.eff.mechanics, 1, rus(entry.eff), entry.level);
      const active = featureFilter(entry);
      for (const f of expandFeatures(entry.eff?.features)) {
        if (f.level > entry.level || (entry.subclass && f.hideInSubclasses) || !active(f)) continue;
        classFeatures.push(multi ? { ...f, classTag: rus(entry.cls), entryKey: entry.key } : { ...f, entryKey: entry.key });
        addMech(f.mechanics, f.level, f.name, entry.level);
      }
    }
    const featureOf = (entry, re) => classFeatures.some(f => f.entryKey === entry.key && re.test(f.name || ''));
    const speciesFeatures = [...(species?.features || []), ...(lineage?.features || [])]
      .filter(f => (f.level || 1) <= CL);
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
    // Feature options the player picked (invocations, metamagic, maneuvers, …) can carry
    // mechanics too (e.g. Devil's Sight → darkvision).
    const choices = collectChoices();
    const chosenOptions = [];
    for (const ch of choices.filter(x => x.type === 'option')) {
      for (const option of pickedOptions(ch)) {
        chosenOptions.push({ choice: ch, option });
        addMech(option.mechanics, ch.level, rus(option));
      }
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
    const skillValues = new Set(lists.skills.map(x => x.value));
    for (const ch of choices.filter(x => x.type === 'skill')) {
      choicePicks(ch, v => skillValues.has(v) && (!ch.options.length || ch.options.includes(v))).forEach(v => skills.add(v));
    }
    // Expertise applies to proficient skills (2014 rogue: also thieves' tools). A skill gets it
    // from one source only: the first choice that took it keeps it, later ones can't repeat it.
    const toolText = [cls?.proficiency?.tool, ...(background?.toolMarkup || []), ...(background?.toolProficiencies || []).map(t => t.url),
      ...choices.filter(x => x.type === 'tool').flatMap(ch => choicePicks(ch))].join(' ').toLowerCase();
    const hasThievesTools = /воровск|thieves/.test(toolText);
    const expertise = new Set();
    const toolExpertise = new Set();
    const expertiseFrom = {}; // value -> choice key that holds it
    for (const ch of choices.filter(x => x.type === 'expertise')) {
      const valid = v => (skills.has(v) || (v === 'THIEVES_TOOLS' && ch.allowTools.includes(v) && hasThievesTools))
        && (!expertiseFrom[v] || expertiseFrom[v] === ch.key);
      for (const v of choicePicks(ch, valid)) {
        expertiseFrom[v] = ch.key;
        (v === 'THIEVES_TOOLS' ? toolExpertise : expertise).add(v);
      }
    }
    const chosenLanguages = choices.filter(x => x.type === 'language')
      .flatMap(ch => choicePicks(ch, v => Boolean(lists.languages?.[v]))).map(v => lists.languages[v]);
    const chosenTools = choices.filter(x => x.type === 'tool')
      .flatMap(ch => choicePicks(ch, v => ch.options.some(o => o.value === v)).map(v => ch.options.find(o => o.value === v).label));
    // Bard's Jack of All Trades: half proficiency on checks without proficiency (incl. initiative).
    const jackOfAllTrades = classFeatures.some(f => /мастер на все руки/i.test(f.name || ''));
    const halfPb = jackOfAllTrades ? Math.floor(pb / 2) : 0;

    // Hit points: the main class's first level at max, every other level at its die's average.
    const hd = eff?.hitDice || cls?.hitDice;
    const hitDice = entries.filter(e => e.eff?.hitDice || e.cls?.hitDice)
      .map(e => ({ level: e.level, die: e.eff?.hitDice || e.cls.hitDice }));
    // In 'rolled' mode each later level uses the entered die result (default: the average).
    const hpLevels = [];
    entries.forEach((e, i) => {
      const die = e.eff?.hitDice || e.cls?.hitDice;
      if (!die) return;
      for (let lvl = i === 0 ? 2 : 1; lvl <= e.level; lvl++) {
        const key = `${e.key}:${lvl}`;
        const roll = s.hpMode === 'rolled' ? clampInt(s.hpRolls[key], 1, die.maxValue, die.avg) : die.avg;
        hpLevels.push({ key, entry: e, lvl, die, roll });
      }
    });
    let hpCalculated = 0;
    if (hd) {
      hpCalculated = Math.max(1, hd.maxValue + mods.CONSTITUTION)
        + hpLevels.reduce((n, x) => n + Math.max(1, x.roll + mods.CONSTITUTION), 0) + mech.hp;
    }
    const hpManual = s.hpMode === 'manual' && Number(s.hpManual) > 0 ? clampInt(s.hpManual, 1, 999, 1) : null;
    const hp = hpManual ?? hpCalculated;

    // Armor class. Extra classes add only the armor their multiclass rules grant.
    const armor = ARMORS.find(a => a.id === s.armor) || ARMORS[0];
    const armorCats = [...new Set([...(cls?.proficiency?.armorData?.category || []),
      ...entries.slice(1).flatMap(e => MULTICLASS_ARMOR[baseClass(e.cls)] || [])])];
    let ac;
    let acNote = armor.id === 'none' ? 'без доспехов' : armor.name.replace(/\s*\(.*\)/, '');
    const barbarian = entries.find(e => baseClass(e.cls) === 'barbarian' && featureOf(e, /защита без доспехов/i));
    const monk = entries.find(e => baseClass(e.cls) === 'monk' && featureOf(e, /защита без доспехов/i));
    const hasDraconicResilience = classFeatures.some(f => /драконья устойчивость/i.test(f.name || ''));
    if (armor.id === 'none') {
      // Unarmored Defense from two classes does not stack: take the better one.
      const options = [10 + mods.DEXTERITY];
      if (hasDraconicResilience) options.push(13 + mods.DEXTERITY);
      if (barbarian) options.push(10 + mods.DEXTERITY + mods.CONSTITUTION);
      if (monk && !s.shield) options.push(10 + mods.DEXTERITY + mods.WISDOM);
      ac = Math.max(...options);
      if (ac > 10 + mods.DEXTERITY) acNote = hasDraconicResilience && ac === 13 + mods.DEXTERITY ? 'драконья устойчивость' : 'защита без доспехов';
    } else {
      ac = armor.base + Math.min(mods.DEXTERITY, armor.maxDex);
    }
    if (s.shield) { ac += 2; acNote += ' + щит'; }
    // Fighting style «Защита» (2014 option "defense", 2024 feat "defense-phb"): +1 AC in armor.
    const defenseStyle = chosenOptions.find(x => x.option.key === 'defense')?.option
      || feats.find(x => /^defense(-|$)/.test(x.feat.url || ''))?.feat;
    if (defenseStyle && armor.id !== 'none') { ac += 1; acNote += ` + стиль «${rus(defenseStyle)}»`; }

    // Speed bonuses: monk Unarmored Movement (from the class table), barbarian Fast Movement.
    let speedBonus = 0;
    const speedNotes = [];
    for (const entry of entries) {
      const col = (entry.eff?.table || []).find(c => /(скорость|движение) без доспехов/i.test(c.name || ''));
      const value = col ? parseInt(String(scalingValue(col, entry.level) || '').replace(/[^\d]/g, ''), 10) : 0;
      if (value && armor.id === 'none' && !s.shield) { speedBonus += value; speedNotes.push(`+${value} без доспехов`); }
    }
    if (classFeatures.some(f => /быстрое передвижение/i.test(f.name || '')) && armor.cat !== 'HEAVY') {
      speedBonus += 10; speedNotes.push('+10 быстрое передвижение');
    }
    const warnings = [];
    // Multiclassing needs 13 in the key abilities of the main class and of each new class.
    if (multi) {
      for (const entry of entries) {
        for (const group of MULTICLASS_REQ[baseClass(entry.cls)] || []) {
          if (!group.some(k => scores[k] >= 13)) {
            warnings.push(`Мультикласс «${rus(entry.cls)}»: нужно ${group.map(k => ABILITY[k].name).join(' или ')} 13+`);
          }
        }
      }
    }
    if (armor.cat && cls && !armorCats.includes(armor.cat)) warnings.push(`Нет владения доспехами: ${ARMOR_CAT_NAMES[armor.cat]}`);
    if (s.shield && cls && !armorCats.includes('SHIELD')) warnings.push('Нет владения щитами');

    // Spellcasting
    const extraSpells = extraSpellsNow(); // racial and feat spells, also for non-casters
    const attacks = computeAttacks({ entries, mods, pb, choices, chosenOptions, feats });

    // Save DC and attack bonus of each racial/feat spell source.
    const extraStats = {};
    for (const src of data.spellSources || []) {
      const ab = sourceAbility(src, { choices, slots, scores });
      extraStats[src.key] = { ...ab, dc: 8 + pb + mods[ab.key], attack: pb + mods[ab.key] };
    }
    // One casting block per spellcasting class; racial/feat spells ride on the first one.
    const casters = [];
    for (const entry of entries) {
      const e = entry.eff;
      if (!e || !isCasterType(e.casterType) || entry.level < (e.spellcastingStartLevel || 1)) continue;
      const sp = castingFor(entry, { mods, pb, extraSpells: casters.length ? [] : extraSpells });
      sp.label = rus(entry.cls) + (entry.subclass ? ` (${rus(entry.subclass)})` : '');
      casters.push(sp);
    }
    // Two or more classes with regular slots share the multiclass spell-slot table.
    const slotCasters = casters.filter(c => c.type !== 'PACT');
    if (slotCasters.length >= 2) {
      const casterLevel = slotCasters.reduce((n, c) => n + casterContribution(c), 0);
      const shared = FULL_SLOTS[Math.min(20, Math.max(1, casterLevel)) - 1] || [];
      slotCasters.forEach(c => { c.slotsRow = shared; c.sharedSlots = casterLevel; });
    }
    const spell = casters[0] || null;

    // Class resources: every non-spell column of each class table, plus counters from mechanics.
    const resources = [];
    const tableKeys = new Set();
    for (const entry of entries) {
      for (const col of entry.eff?.table || []) {
        tableKeys.add(col.key);
        if (['CANTRIPS_KNOWN', 'PREPARED_SPELLS', 'SPELLS_KNOWN', 'PACT_SLOTS', 'PACT_LEVEL'].includes(col.purpose)) continue;
        if (/(скорость|движение) без доспехов/i.test(col.name || '')) continue; // applied to speed
        const v = scalingValue(col, entry.level);
        if (v != null && v !== '' && v !== '—' && v !== '-') resources.push({ name: col.name + (multi ? ` (${rus(entry.cls)})` : ''), value: v });
      }
    }
    for (const c of mech.counters) {
      if (c.key && tableKeys.has(c.key)) continue; // already shown from the class table
      let max = c.max;
      if (Array.isArray(c.scaling) && c.scaling.length) {
        max = null;
        for (const step of c.scaling) if (step.level <= c.classLevel) max = step.max;
        if (max == null) continue; // not unlocked yet
      }
      resources.push({ name: c.name, value: evalCounter(max, { pb, L: c.classLevel, mods }), recovery: c.recovery });
    }

    // Walking speed with all bonuses; climb/swim/fly that equal it (e.g. TCE Roving).
    if (mech.speedBonus) speedNotes.push(`+${mech.speedBonus}`);
    const walkSpeed = (props.movement?.base || 30) + speedBonus + mech.speedBonus;
    const movement = { ...(props.movement || {}) };
    for (const kind of mech.equalsWalk) movement[kind] = Math.max(movement[kind] || 0, walkSpeed);

    // Feat prerequisites, checked against the finished character.
    const raceName = `${rus(species)} ${rus(lineage)}`.toLowerCase();
    const featIssues = {};
    for (const { slot, feat } of feats) {
      const issues = prerequisiteIssues(feat, { scores, L: CL, isCaster: Boolean(spell) || extraSpells.length > 0, armorCats, raceName });
      if (issues.length) {
        featIssues[slot.key] = issues;
        warnings.push(`Черта «${rus(feat)}»: не выполнено — ${issues.join(', ')}`);
      }
    }

    return {
      L, CL, multi, entries, casters, hitDice, hpLevels, hpCalculated, pb, base, scores, mods, sources, bgAbils, slots, feats,
      saves, skills, bgSkills, classSkills, skillData,
      expertise, toolExpertise, expertiseFrom, hasThievesTools, halfPb, jackOfAllTrades, choices, chosenOptions, chosenLanguages, chosenTools, featIssues,
      hp, hd, ac, acNote, warnings,
      init: mods.DEXTERITY + (mech.initPB ? pb : halfPb) + mech.initBonus, initPB: mech.initPB,
      racePlan, extraSpells, extraStats, attacks,
      speed: walkSpeed, speedNotes, movement, size: props.size, creatureType: props.type,
      mech, classFeatures, speciesFeatures, spell, resources,
    };
  }

  // ---------- weapons & attacks ----------

  const WPN = window.DND_WEAPONS;
  const weaponsForEdition = () => WPN.WEAPONS.map(w => WPN.forEdition(w, edition));
  // Multiclassing into these grants simple and martial weapons (PHB).
  const MULTICLASS_WEAPONS = new Set(['fighter', 'paladin', 'ranger', 'barbarian']);
  // 2014 racial weapon training (the 2024 species have none).
  const RACE_WEAPONS_2014 = {
    elf: ['longsword', 'shortsword', 'shortbow', 'longbow'],
    dwarf: ['battleaxe', 'handaxe', 'light-hammer', 'warhammer'],
  };

  // Which weapons the character is proficient with.
  function weaponProficiency(entries) {
    const all = weaponsForEdition();
    const keys = new Set();
    const addCat = (cat, kind) => all.filter(w => w.cat === cat && (!kind || w.kind === kind)).forEach(w => keys.add(w.key));
    const main = entries[0]?.cls;
    const wd = main?.proficiency?.weaponData;
    if (wd?.category?.length) {
      // 2024: SIMPLE_MELEE … (TTG writes martial as "MATERIAL_*") plus a free-text extra.
      for (const c of wd.category) {
        const [cat, kind] = c.toLowerCase().split('_');
        addCat(cat === 'simple' ? 'simple' : 'martial', kind === 'melee' ? 'melee' : 'ranged');
      }
      const custom = String(wd.custom || '').toLowerCase();
      if (/воинск/.test(custom)) {
        all.filter(w => w.cat === 'martial'
          && ((/фехтов/.test(custom) && w.props.includes('finesse')) || (/л[её]гк/.test(custom) && w.props.includes('light'))))
          .forEach(w => keys.add(w.key));
      }
    } else {
      // 2014: "Простое оружие, длинные мечи, рапиры, …" or "Простое и воинское оружие".
      for (const seg of String(main?.proficiency?.weapon || '').toLowerCase().split(/[,;]\s*/)) {
        if (/простое/.test(seg)) addCat('simple');
        if (/воинское/.test(seg)) addCat('martial');
        all.filter(w => w.stem.test(seg.trim())).forEach(w => keys.add(w.key));
      }
    }
    for (const e of entries.slice(1)) if (MULTICLASS_WEAPONS.has(baseClass(e.cls))) { addCat('simple'); addCat('martial'); }
    if (edition === '2014') (RACE_WEAPONS_2014[String(data.species?.url || '')] || []).forEach(k => keys.add(k));
    return keys;
  }

  // Attack rows for the chosen weapons plus an unarmed strike.
  function computeAttacks({ entries, mods, pb, choices, chosenOptions, feats }) {
    const proficient = weaponProficiency(entries);
    const styles = new Set([
      ...chosenOptions.map(x => x.option.key),
      ...feats.map(x => String(x.feat.url || '').replace(/-phb$/, '').replace(/-/g, '_')),
    ]);
    const masteries = new Set(choices.filter(ch => ch.type === 'mastery').flatMap(ch => choicePicks(ch, v => proficient.has(v))));
    const all = weaponsForEdition();
    const rows = [];
    for (const key of state.weapons) {
      const w = all.find(x => x.key === key);
      if (!w) continue;
      const finesse = w.props.includes('finesse');
      const ability = w.kind === 'ranged' ? 'DEXTERITY'
        : finesse ? (mods.DEXTERITY > mods.STRENGTH ? 'DEXTERITY' : 'STRENGTH') : 'STRENGTH';
      const mod = mods[ability];
      const prof = proficient.has(w.key);
      const twoHanded = w.props.includes('twoHanded');
      let attackBonus = mod + (prof ? pb : 0);
      let dmgBonus = mod;
      const notes = [];
      if (w.kind === 'ranged' && styles.has('archery')) { attackBonus += 2; notes.push('стиль «Стрельба» +2'); }
      if (w.kind === 'melee' && !twoHanded && styles.has('dueling')) { dmgBonus += 2; notes.push('«Дуэлянт» +2 урона в одной руке'); }
      if (w.props.includes('thrown') && styles.has('thrown_weapon_fighting')) notes.push('«Метательное оружие»: +2 урона при броске');
      if ((twoHanded || w.versatile) && w.kind === 'melee' && styles.has('great_weapon_fighting')) notes.push('«Большое оружие»: перебрасывание 1 и 2');
      const fmt = dice => `${dice}${dmgBonus ? ` ${dmgBonus > 0 ? '+' : '−'} ${Math.abs(dmgBonus)}` : ''}`;
      rows.push({
        key: w.key, name: w.rus, prof, ability, attack: attackBonus,
        damage: `${fmt(w.dmg)} ${w.type}`, versatile: w.versatile ? fmt(w.versatile) : '',
        props: w.props.map(p => WPN.PROPERTY_NAMES[p]).concat(w.range ? [`дистанция ${w.range} фт.`] : []),
        mastery: masteries.has(w.key) ? WPN.MASTERY_NAMES[w.mastery] || '' : '',
        notes,
      });
    }
    // Unarmed strike: everyone is proficient; a monk uses the martial arts die and STR or DEX.
    const monk = entries.find(e => baseClass(e.cls) === 'monk');
    const maCol = monk && (monk.eff?.table || []).find(col => /боев\S* искусств/i.test(col.name || ''));
    const maDie = maCol ? scalingValue(maCol, monk.level) : null;
    const unarmedAbility = maDie && mods.DEXTERITY > mods.STRENGTH ? 'DEXTERITY' : 'STRENGTH';
    const um = mods[unarmedAbility];
    rows.push({
      key: 'unarmed', name: 'Безоружный удар', prof: true, ability: unarmedAbility, attack: um + pb,
      damage: maDie ? `${maDie}${um ? ` ${um > 0 ? '+' : '−'} ${Math.abs(um)}` : ''} дробящий` : `${Math.max(0, 1 + um)} дробящий`,
      versatile: '', props: maDie ? ['боевые искусства'] : [], mastery: '', notes: [],
    });
    return { rows, proficient };
  }

  // 2014 starting equipment is text: "{@list {@li а) X или б) Y}{@li Z}}". Split it into lines
  // with their alternatives so the player can choose.
  function equipmentLines14(markup) {
    const text = (markup || []).join(' ');
    const lines = [];
    let i = text.indexOf('{@li ');
    while (i !== -1) {
      let depth = 0;
      let j = i;
      for (; j < text.length; j++) {
        if (text[j] === '{') depth++;
        else if (text[j] === '}' && --depth === 0) break;
      }
      const body = text.slice(i + 5, j).trim();
      const options = body.split(/\s+или\s+(?=[а-е]\)\s)/).map(o => o.replace(/^[а-е]\)\s*/, '').trim()).filter(Boolean);
      lines.push({ options });
      i = text.indexOf('{@li ', j);
    }
    const notes = (markup || []).filter(m => !m.includes('{@list'));
    return { lines, notes };
  }

  // Casting ability of a class list ("wizard-phb" / "wizard").
  const LIST_ABILITY = {
    bard: 'CHARISMA', cleric: 'WISDOM', druid: 'WISDOM', sorcerer: 'CHARISMA', warlock: 'CHARISMA',
    wizard: 'INTELLIGENCE', artificer: 'INTELLIGENCE', paladin: 'CHARISMA', ranger: 'WISDOM',
  };

  // Spellcasting ability of a racial/feat spell source: the player's pick where the data has
  // one (2024), else the source's rule (fixed / class list / ability the feat raised),
  // else the best mental ability.
  function sourceAbility(src, { choices, slots, scores }) {
    for (const ch of choices) {
      if (ch.type === 'ability' && (src.choicePrefixes || []).some(p => ch.key.startsWith(`${p}:`))) {
        const pick = choicePicks(ch, v => Boolean(ABILITY[v]))[0];
        if (pick) return { key: pick, chosen: true };
      }
    }
    if (src.ability === 'fromList') {
      const ref = sourceListRef(src, { list: 'choice' });
      const key = LIST_ABILITY[String(ref).replace(/-[a-z0-9]+$/, '')];
      if (key) return { key };
    }
    if (src.ability === 'fromBonus') {
      const slot = slots.find(x => `feat:${x.key}` === src.key);
      const plan = slot && featBonusPlan(slot);
      if (plan?.chosen?.[0]) return { key: plan.chosen[0] };
    }
    if (ABILITY[src.ability]) return { key: src.ability };
    const best = ['INTELLIGENCE', 'WISDOM', 'CHARISMA'].sort((a, b) => scores[b] - scores[a])[0];
    return { key: best, guessed: true };
  }

  // Spellcasting of one class entry at its own class level.
  function castingFor(entry, { mods, pb, extraSpells }) {
    const eff = entry.eff;
    const L = entry.level;
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
    // Which spell levels this class may pick is set by its own slots, even when multiclassed.
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
    // player also ticked one of them. Racial and feat spells are free the same way.
    const alwaysSpells = alwaysPrepared(entry).map(g => ({ ...g.spell, alwaysFrom: g.from, grantedAt: g.level }));
    for (const x of extraSpells) if (!alwaysSpells.some(a => a.url === x.url)) alwaysSpells.push(x);
    const alwaysUrls = new Set(alwaysSpells.map(x => x.url));
    const picks = spellPicksOf(entry.key);
    const chosen = spellPool(entry).filter(sp => picks.includes(sp.url) && !alwaysUrls.has(sp.url));
    return {
      entryKey: entry.key, entry, classLevel: L, edition: eff.edition || '2024',
      type: eff.casterType, abilityKey, abilityMod,
      dc: 8 + pb + abilityMod, attack: pb + abilityMod,
      slotsRow, pact, maxLevel, cantripLimit, preparedLimit, limitLabel,
      cantrips: chosen.filter(sp => sp.level === 0),
      leveled: chosen.filter(sp => sp.level > 0 && sp.level <= maxLevel),
      always: alwaysSpells, alwaysUrls,
    };
  }

  // Caster levels a class adds to the multiclass slot table (PHB). 2024 rounds half casters
  // up; 2014 rounds down (artificer up). Third casters round down in both.
  function casterContribution(caster) {
    const L = caster.classLevel;
    if (caster.type === 'FULL') return L;
    if (caster.type === 'HALF') {
      return caster.edition === '2024' || baseClass(caster.entry.cls) === 'artificer' ? Math.ceil(L / 2) : Math.floor(L / 2);
    }
    if (caster.type === 'THIRD') return Math.floor(L / 3);
    return 0;
  }

  const ABILITY_STEMS = [
    ['сил', 'STRENGTH'], ['ловк', 'DEXTERITY'], ['телосл', 'CONSTITUTION'],
    ['интел', 'INTELLIGENCE'], ['мудр', 'WISDOM'], ['харизм', 'CHARISMA'],
  ];
  const RACE_WORDS = ['полуэльф', 'полуорк', 'полурослик', 'эльф', 'дварф', 'гном', 'драконорожд', 'тифлинг', 'человек'];

  // Unmet prerequisites of a feat, as short human-readable reasons.
  // 2024 feats have structured prerequisiteDetails; 2014 ones only text, parsed loosely.
  function prerequisiteIssues(feat, { scores, L, isCaster, armorCats, raceName }) {
    const issues = [];
    const d = feat.prerequisiteDetails;
    if (d) {
      if (d.minCharacterLevel && L < d.minCharacterLevel) issues.push(`уровень ${d.minCharacterLevel}+`);
      for (const req of d.abilities || []) {
        const any = req.anyOf || [];
        if (any.length && !any.some(k => (scores[k] || 0) >= req.minValue)) {
          issues.push(`${any.map(k => ABILITY[k]?.name || k).join(' или ')} ${req.minValue}+`);
        }
      }
      if ((d.classFeatures || []).some(x => /SPELLCASTING|PACT_MAGIC/.test(x)) && !isCaster) issues.push('умение накладывать заклинания');
      return issues;
    }
    const text = String(feat.prerequisite || '').toLowerCase();
    if (!text) return issues;
    const num = /(\d{2})/.exec(text);
    const abilities = ABILITY_STEMS.filter(([stem]) => text.includes(stem)).map(([, key]) => key);
    if (num && abilities.length) {
      const min = Number(num[1]);
      const ok = /\sили\s/.test(text) ? abilities.some(k => scores[k] >= min) : abilities.every(k => scores[k] >= min);
      if (!ok) issues.push(`${abilities.map(k => ABILITY[k].name).join(/\sили\s/.test(text) ? ' или ' : ' и ')} ${min}+`);
    }
    if (/заклинани/.test(text) && !isCaster) issues.push('умение накладывать заклинания');
    const armorReq = [['лёгк', 'LIGHT'], ['легк', 'LIGHT'], ['средн', 'MEDIUM'], ['тяжёл', 'HEAVY'], ['тяжел', 'HEAVY']]
      .find(([stem]) => new RegExp(`владени\\S*\\s+${stem}`).test(text));
    if (armorReq && !armorCats.includes(armorReq[1])) issues.push('владение доспехами');
    const race = RACE_WORDS.find(w => text.includes(w));
    if (race && !raceName.includes(race)) issues.push(`раса: ${race}`);
    return issues;
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
    extraSpells: $('extraSpells'), choicesPanel: $('choicesPanel'), choicesBody: $('choicesBody'), optionalBody: $('optionalBody'),
    multiclassEditor: $('multiclassEditor'), addClassBtn: $('addClassBtn'), levelLabel: $('levelLabel'), hpEditor: $('hpEditor'),
    weaponSelect: $('weaponSelect'), weaponList: $('weaponList'), inventoryList: $('inventoryList'), rosterSelect: $('rosterSelect'),
    itemName: $('itemNameInput'), itemQty: $('itemQtyInput'),
    casterSwitch: $('casterSwitch'),
    filterLevels: $('filterLevels'), filterSchools: $('filterSchools'), filterConcGroup: $('filterConcGroup'),
    filterRitualGroup: $('filterRitualGroup'), filterNoV: $('filterNoV'), filterNoS: $('filterNoS'),
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

    renderMulticlass(c);
    renderHpEditor(c);
    renderFeatSlots(c);
    renderChoices(c);
    renderSpells(c);
    renderEquipmentChoices(c);
  }

  function renderHpEditor(c) {
    document.querySelectorAll('input[name="hpMode"]').forEach(r => { r.checked = r.value === state.hpMode; });
    const signature = JSON.stringify([state.hpMode, c.hpLevels.map(x => [x.key, x.die.maxValue]), state.hpMode === 'rolled' ? state.hpRolls : null,
      c.hd?.maxValue, c.mods.CONSTITUTION]);
    renderSection('hp', signature, () => {
      if (!c.hd) { el.hpEditor.innerHTML = '<p class="hint">Выберите класс.</p>'; return; }
      if (state.hpMode === 'manual') {
        el.hpEditor.innerHTML = `<label>Максимум хитов <input type="number" min="1" max="999" data-hp-manual value="${esc(state.hpManual ?? '')}" placeholder="${c.hpCalculated}"></label>
          <p class="hint">Расчётное значение: ${c.hpCalculated}. Пустое поле — использовать расчёт.</p>`;
        return;
      }
      if (state.hpMode === 'average') {
        el.hpEditor.innerHTML = `<p class="hint">1-й уровень — максимум кости (${c.hd.maxValue}), далее среднее за уровень; плюс модификатор Телосложения и бонусы.</p>`;
        return;
      }
      el.hpEditor.innerHTML = c.hpLevels.length ? `
        <p class="hint">1-й уровень: ${c.hd.maxValue} (максимум). Результаты бросков за следующие уровни, без Телосложения:</p>
        <div class="hpRolls">${c.hpLevels.map(x => `<label title="${esc(rus(x.entry.cls))}, уровень ${x.lvl}">${c.multi ? esc(rus(x.entry.cls)).slice(0, 4) + '. ' : ''}${x.lvl} ур. (${esc(x.die.label)})
          <input type="number" min="1" max="${x.die.maxValue}" data-hp-roll="${esc(x.key)}" value="${x.roll}"></label>`).join('')}</div>
        <button type="button" data-action="roll-hp" class="smallBtn">Бросить все кости</button>`
        : '<p class="hint">На 1 уровне бросать нечего: берётся максимум кости.</p>';
    });
  }

  // Extra classes: class, subclass (when unlocked), level and a remove button each.
  function renderMulticlass(c) {
    const others = state.multiclass.reduce((n, m) => n + (m.classUrl ? m.level : 0), 0);
    el.level.max = String(Math.max(1, 20 - others));
    el.levelLabel.textContent = state.multiclass.length ? 'Уровень основного класса' : 'Уровень';
    el.addClassBtn.hidden = state.multiclass.length >= 3 || c.CL >= 20 || !state.classUrl;
    const loaded = Object.fromEntries((data.entries || []).map(e => [e.key, e]));
    const signature = JSON.stringify([state.multiclass, state.classUrl, sourcesKey(), c.CL,
      (data.entries || []).map(e => [e.key, e.subclasses?.length, e.cls?.subclassLevel])]);
    renderSection('multiclass', signature, () => {
      if (!state.multiclass.length) { el.multiclassEditor.innerHTML = ''; return; }
      const taken = new Set([state.classUrl, ...state.multiclass.map(m => m.classUrl)]);
      el.multiclassEditor.innerHTML = `<div class="choiceTitle">Мультикласс · уровень персонажа ${c.CL}</div>${state.multiclass.map((m, i) => {
        const entry = loaded[`mc${i}`];
        const classOptions = lists.classes.filter(x => x.url === m.classUrl || (!taken.has(x.url) && isAllowed(x)));
        const subLevel = entry?.cls?.subclassLevel || 3;
        const sub = entry?.cls?.hasSubclasses && entry.subclasses?.length
          ? `<label>${esc(entry.cls.subclassLabel || 'Подкласс')}${m.level < subLevel ? ` <span class="muted">(с ${subLevel} ур.)</span>` : ''}
              <select data-mc-field="subclassUrl" data-mc="${i}"${m.level < subLevel ? ' disabled' : ''}><option value="">— не выбран —</option>${
                sortByName(entry.subclasses).filter(x => isAllowed(x) || x.url === m.subclassUrl).map(x =>
                  `<option value="${esc(x.url)}"${x.url === m.subclassUrl ? ' selected' : ''}>${esc(rus(x))} [${esc(x.source?.name?.label || '')}]</option>`).join('')}</select></label>` : '';
        return `<div class="mcRow">
          <div class="row">
            <label>Класс <select data-mc-field="classUrl" data-mc="${i}"><option value="">— выберите —</option>${classOptions.map(x =>
              `<option value="${esc(x.url)}"${x.url === m.classUrl ? ' selected' : ''}>${esc(rus(x))} [${esc(x.source?.name?.label || '')}]</option>`).join('')}</select></label>
            <label>Уровень <input type="number" min="1" max="19" value="${m.level}" data-mc-field="level" data-mc="${i}"></label>
          </div>
          ${sub}
          <button type="button" class="linkish" data-mc-remove="${i}">убрать класс</button>
        </div>`;
      }).join('')}`;
    });
  }

  const CHOICE_TYPE_HINTS = {
    expertise: 'компетентность', skill: 'навыки', language: 'языки', tool: 'инструменты',
    ability: 'заклинательная характеристика', mastery: 'оружейные приёмы',
  };

  // TCE optional class features (2014): a checkbox each, with what it replaces.
  function renderOptionalFeatures(c) {
    const rows = [];
    for (const entry of c.entries) {
      const features = entry.eff?.features || [];
      for (const f of features) {
        if (!f.optional || f.optionalGroup || f.level > entry.level) continue;
        const replaced = [
          ...(f.replaces?.ids || []).map(id => features.find(g => g.featureId === id)?.name).filter(Boolean),
          ...(f.replaces?.names || []),
        ];
        const parts = features.filter(g => g.optionalGroup === f.name).map(g => `${g.name} (${g.level} ур.)`);
        rows.push({ key: optionalKey(entry, f), f, replaced: [...new Set(replaced)], parts, tag: c.multi ? rus(entry.cls) : '' });
      }
    }
    renderSection('optional', JSON.stringify([rows.map(r => r.key), state.optionalFeatures]), () => {
      el.optionalBody.innerHTML = rows.length ? `<div class="choiceGroup choiceBlock">
        <div class="choiceTitle">Опциональные умения (TCE) <span class="muted">— по умолчанию правила PHB</span></div>
        <div class="filterChecks">${rows.map(r => `<label class="check">
          <input type="checkbox" data-optional="${esc(r.key)}"${state.optionalFeatures[r.key] ? ' checked' : ''}>
          <span>${esc(r.f.name)} <span class="muted">${r.f.level} ур.${r.tag ? ` · ${esc(r.tag)}` : ''}${r.replaced.length ? ` · заменяет «${esc(r.replaced.join('» / «'))}»` : ' · дополнительно'}${r.parts.length ? ` · включает: ${esc(r.parts.join(', '))}` : ''}</span></span>
        </label>`).join('')}</div></div>` : '';
    });
    return rows.length;
  }

  function renderChoices(c) {
    const optionalCount = renderOptionalFeatures(c);
    el.choicesPanel.hidden = !c.choices.length && !optionalCount;
    const signature = JSON.stringify([c.choices.map(ch => [ch.key, ch.type, ch.count, (ch.options || []).length]),
      state.choices, [...c.skills], state.level, Object.keys(lists.languages || {}).length, [...c.attacks.proficient], c.expertiseFrom, c.hasThievesTools]);
    renderSection('choices', signature, () => {
      el.choicesBody.innerHTML = c.choices.map(ch => {
        const picks = state.choices[ch.key] || [];
        const head = `<div class="choiceTitle">${esc(ch.title)}${ch.label && ch.label !== ch.title ? ` — ${esc(ch.label)}` : ''}
          <span class="muted">(${ch.type === 'option' ? 'выбрано' : CHOICE_TYPE_HINTS[ch.type] + ':'} ${picks.filter(Boolean).length > ch.count ? ch.count : picks.filter(Boolean).length} из ${ch.count})</span></div>`;
        const selects = (options, info) => `<div class="bonusPicks">${Array.from({ length: ch.count }, (_, i) => `<div class="pickRow">
          <select data-choice="${esc(ch.key)}" data-index="${i}"><option value="">— выберите —</option>${options.map(o =>
            `<option value="${esc(o.value)}"${picks[i] === o.value ? ' selected' : ''}${o.disabled && picks[i] !== o.value ? ' disabled' : ''}>${esc(o.label)}</option>`).join('')}</select>
          ${info && picks[i] ? `<button type="button" class="linkish" data-option-info="${esc(ch.key)}|${esc(picks[i])}">?</button>` : ''}</div>`).join('')}</div>`;
        let body = '';
        if (ch.type === 'option') {
          body = selects(ch.options.map(o => ({
            value: o.key,
            label: `${rus(o)}${o.requiredClassLevel && o.requiredClassLevel > state.level ? ` (с ${o.requiredClassLevel} ур.)` : ''}${o.prerequisite?.length && !o.requiredClassLevel ? ` — ${o.prerequisite.join('; ')}` : ''}`,
            disabled: o.requiredClassLevel && o.requiredClassLevel > state.level,
          })), true);
        } else if (ch.type === 'expertise') {
          // Proficient skills (+ thieves' tools for the 2014 rogue). A skill that already has
          // expertise from another source is locked here.
          const pool = lists.skills.filter(sk => c.skills.has(sk.value)).map(sk => ({ value: sk.value, label: sk.label }));
          if (ch.allowTools.includes('THIEVES_TOOLS') && c.hasThievesTools) pool.push({ value: 'THIEVES_TOOLS', label: 'Воровские инструменты' });
          const held = pool.filter(x => c.expertiseFrom[x.value] === ch.key).length;
          const titleOf = key => c.choices.find(x => x.key === key)?.title || 'другой источник';
          body = `<div class="chips">${pool.map(x => {
            const owner = c.expertiseFrom[x.value];
            const on = owner === ch.key;
            const elsewhere = owner && !on;
            const full = !on && held >= ch.count;
            return `<label${elsewhere ? ` title="Уже компетентность: ${esc(titleOf(owner))}"` : ''}><input type="checkbox" data-choice-check="${esc(ch.key)}" value="${esc(x.value)}"${on || elsewhere ? ' checked' : ''}${elsewhere || full ? ' disabled' : ''}> ${esc(x.label)}${elsewhere ? ' <span class="muted">(уже)</span>' : ''}</label>`;
          }).join('') || '<span class="hint">Нет навыков с владением.</span>'}</div>`;
        } else if (ch.type === 'skill') {
          const pool = lists.skills.filter(sk => !ch.options.length || ch.options.includes(sk.value));
          const chosen = choicePicks(ch);
          body = `<div class="chips">${pool.map(sk => {
            const on = chosen.includes(sk.value);
            const already = !on && c.skills.has(sk.value);
            const full = !on && chosen.length >= ch.count;
            return `<label${already ? ' title="Уже есть владение"' : ''}><input type="checkbox" data-choice-check="${esc(ch.key)}" value="${esc(sk.value)}"${on || already ? ' checked' : ''}${already || full ? ' disabled' : ''}> ${esc(sk.label)}</label>`;
          }).join('') || '<span class="hint">Нет подходящих навыков.</span>'}</div>`;
        } else if (ch.type === 'language') {
          body = selects(Object.entries(lists.languages || {}).map(([value, label]) => ({ value, label })), false);
        } else if (ch.type === 'tool') {
          body = selects(ch.options.map(o => ({ value: o.value, label: o.label })), false);
        } else if (ch.type === 'ability') {
          body = selects(ch.options.map(k => ({ value: k, label: ABILITY[k].name })), false);
        } else if (ch.type === 'mastery') {
          body = selects(weaponsForEdition().filter(w => c.attacks.proficient.has(w.key))
            .map(w => ({ value: w.key, label: `${w.rus} — ${WPN.MASTERY_NAMES[w.mastery] || ''}` })), false);
        }
        return `<div class="choiceGroup choiceBlock">${head}${body}</div>`;
      }).join('');
    });
  }

  function renderFeatSlots(c) {
    const signature = JSON.stringify([c.slots.map(sl => [sl.key, slotFeatUrl(sl)]), state.feats,
      Object.entries(data.featLists).map(([k, v]) => [k, v.length]), Object.keys(data.feats).length, sourcesKey(), c.featIssues]);
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
          const groups = (slot.categories || ['GENERAL']).map(cat => [
            P.rules.originFeat ? FEAT_CATEGORY_NAMES[cat] || cat : 'Черты', data.featLists[cat] || []]);
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
        const issues = c.featIssues[slot.key] || [];
        const prereq = feat?.prerequisite
          ? `<div class="hint${issues.length ? ' warn' : ''}">Требование: ${esc(feat.prerequisite)}${issues.length ? ` — не выполнено: ${esc(issues.join(', '))}` : ''}</div>` : '';
        return `<div class="featSlot"><div class="slotTitle">${esc(slot.title)}</div>${picker}${prereq}${bonus}</div>`;
      }).join('');
    });
  }

  // ---------- spells tab ----------

  const defaultSpellFilter = () => ({
    search: '', levels: new Set(), schools: new Set(), conc: 'any', ritual: 'any',
    noV: false, noS: false, noM: false, chosen: false, available: true,
  });
  let spellFilter = defaultSpellFilter();
  let lastComputed = null;
  let activeCaster = 'main'; // which class's spells the tab edits when multiclassed

  const levelName = lvl => (lvl === 0 ? 'Заговоры' : `${lvl} уровень`);

  function spellMatches(x, sp) {
    const f = spellFilter;
    // Granted spells come with the subclass, whatever books are ticked.
    const chosen = spellPicksOf(sp.entryKey).includes(x.url) || sp.alwaysUrls.has(x.url);
    if (!isAllowed(x) && !chosen) return false;
    if (x.level === 0 && !sp.cantripLimit && !chosen) return false; // class has no cantrips
    if (f.available && x.level > sp.maxLevel && !chosen) return false;
    if (f.chosen && !chosen) return false;
    if (f.levels.size && !f.levels.has(x.level)) return false;
    if (f.schools.size && !f.schools.has(x.school)) return false;
    if (f.conc === 'yes' && !x.concentration) return false;
    if (f.conc === 'no' && x.concentration) return false;
    if (f.ritual === 'yes' && !x.ritual) return false;
    if (f.ritual === 'no' && x.ritual) return false;
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
      state.extraSpells, state.level, Object.entries(data.spellCandidates || {}).map(([k, v]) => [k, v.length]), sourcesKey(), c.extraStats]);
    renderSection('extraSpells', signature, () => {
      if (!sources.length) { el.extraSpells.innerHTML = ''; return; }
      const spellLink = x => `<button type="button" class="linkish" data-spell-info="${esc(x.url)}">${esc(rus(x))}</button>`;
      el.extraSpells.innerHTML = `<section class="extraSpells">
        <h3>Заклинания расы и черт <span class="muted">— всегда подготовлены, не учитываются в лимите</span></h3>
        ${sources.map(src => {
          const pick = state.extraSpells[src.key] || {};
          const fixed = src.fixed.filter(f => f.spell).map(f => f.level <= charLevel()
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
          const st = c.extraStats[src.key];
          const stats = st ? `<span class="muted">Сл ${st.dc} · атака ${signed(st.attack)} · ${esc(ABILITY[st.key]?.short || '')}${st.guessed ? ' (наибольшая; выберите характеристику в «Выборах»)' : ''}</span>` : '';
          return `<div class="extraSource"><div class="slotTitle">${esc(src.title)} <span class="tag">${esc(src.tag)}</span> ${stats}</div>
            ${fixed ? `<ul class="list">${fixed}</ul>` : ''}${list}${choices}</div>`;
        }).join('')}
      </section>`;
    });
  }

  function renderSpells(c) {
    lastComputed = c;
    const sp = c.casters.find(x => x.entryKey === activeCaster) || c.casters[0] || null;
    if (sp) activeCaster = sp.entryKey;
    renderExtraSpells(c);
    el.spellPanel.hidden = !sp && !c.extraSpells.length;
    const total = c.casters.reduce((n, x) => n + x.cantrips.length + x.leveled.length + x.always.length, 0);
    el.tabSpellCount.textContent = total ? String(total) : c.extraSpells.length ? String(c.extraSpells.length) : '';
    // Multiclassed casters: one button per class; the tab edits the selected one.
    el.casterSwitch.innerHTML = c.casters.length > 1 ? c.casters.map(x =>
      `<button type="button" data-caster="${esc(x.entryKey)}" aria-pressed="${x === sp}">${esc(x.label)}</button>`).join('') : '';

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

    el.spellSummary.innerHTML = c.casters.map(x => (c.casters.length > 1 ? `<b>${esc(x.label)}</b>: ` : '') + spellCountsHtml(x)).join('<br>');
    el.spellCounts.innerHTML = spellCountsHtml(sp) + (sp.sharedSlots ? ` · ячейки мультикласса: уровень заклинателя <b>${sp.sharedSlots}</b>` : '');
    const picks = spellPicksOf(sp.entryKey);
    const listKey = `${sp.entryKey}|${sp.entry.spellsKey}`;

    // Everything the tab can show: the pickable pool plus granted spells outside the class list.
    const pickable = spellPool(sp.entry);
    const pickableUrls = new Set(pickable.map(x => x.url));
    const browse = [...pickable, ...sp.always.filter(x => !pickableUrls.has(x.url))];
    const alwaysFrom = new Map(sp.always.map(x => [x.url, x.alwaysFrom]));
    const alwaysTag = new Map(sp.always.map(x => [x.url, x.sourceTag || 'всегда']));
    const grantedKey = [...sp.alwaysUrls].join(',') + '|' + pickable.filter(x => x.expanded).length;

    // Filter chips depend on the spell list (edition, class, books).
    const pool = browse.filter(x => isAllowed(x) || picks.includes(x.url) || sp.alwaysUrls.has(x.url));
    renderSection('spellChips', `${listKey}|${sourcesKey()}|${grantedKey}`, () => {
      const levels = [...new Set(pool.map(x => x.level))].sort((a, b) => a - b);
      const schools = [...new Set(pool.map(x => x.school).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
      el.filterLevels.innerHTML = levels.map(l => `<label><input type="checkbox" data-filter-level="${l}"${spellFilter.levels.has(l) ? ' checked' : ''}> ${l === 0 ? 'Заговор' : l}</label>`).join('');
      el.filterSchools.innerHTML = schools.map(s => `<label><input type="checkbox" data-filter-school="${esc(s)}"${spellFilter.schools.has(s) ? ' checked' : ''}> ${esc(s)}</label>`).join('');
      // The 2014 list data has no concentration/ritual flags; hide filters it cannot answer.
      el.filterConcGroup.hidden = !pool.some(x => x.concentration);
      el.filterRitualGroup.hidden = !pool.some(x => x.ritual);
    });

    const f = spellFilter;
    const filterKey = JSON.stringify([f.search, [...f.levels], [...f.schools], f.conc, f.ritual, f.noV, f.noS, f.noM, f.available,
      f.chosen ? picks : null]);
    renderSection('spellRows', `${listKey}|${sp.maxLevel}|${sp.cantripLimit}|${sourcesKey()}|${grantedKey}|${filterKey}`, () => {
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
      box.checked = picks.includes(box.dataset.spell);
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
    document.querySelectorAll('input[name="filterRitual"]').forEach(r => { r.checked = r.value === spellFilter.ritual; });
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

  function renderEquipmentChoices(c) {
    const { cls, background } = data;
    renderSection('equip', `${cls?.url}|${background?.url}|${state.classEquip}|${state.bgEquip}|${JSON.stringify(state.equip14)}`, () => {
      const group = (title, options, key, selected) => {
        if (!options?.length) return '';
        return `<div class="choiceGroup"><div class="choiceTitle">${title}</div><div class="chips">${options.map((o, i) =>
          `<label><input type="radio" name="${key}" data-equip="${key}" value="${i}"${i === selected ? ' checked' : ''}> Вариант ${esc(o.label || i + 1)}</label>`).join('')}</div></div>`;
      };
      let html = group('Стартовое снаряжение класса', cls?.startingEquipment, 'classEquip', state.classEquip)
        + group('Снаряжение предыстории', background?.startingEquipment, 'bgEquip', state.bgEquip);
      // 2014: one line per item, with "а) … или б) …" alternatives to pick from.
      if (cls?.equipmentMarkup?.length) {
        const { lines } = equipmentLines14(cls.equipmentMarkup);
        html += `<div class="choiceGroup"><div class="choiceTitle">Стартовое снаряжение класса</div>${lines.map((line, i) => line.options.length > 1
          ? `<div class="equipLine">${line.options.map((opt, j) => `<label class="check"><input type="radio" name="eq14-${i}" data-equip14="${i}" value="${j}"${(state.equip14[i] ?? 0) === j ? ' checked' : ''}> ${inline(opt)}</label>`).join('')}</div>`
          : `<div class="equipLine">${inline(line.options[0] || '')}</div>`).join('')}</div>`;
      }
      el.equipment.innerHTML = html;
    });

    // Weapons: picker (grouped, proficient ones marked) and the chosen list.
    const weapons = weaponsForEdition();
    renderSection('weapons', JSON.stringify([edition, state.weapons, [...c.attacks.proficient]]), () => {
      const opt = w => `<option value="${w.key}">${esc(w.rus)} (${esc(w.dmg)})${c.attacks.proficient.has(w.key) ? '' : ' — без владения'}</option>`;
      el.weaponSelect.innerHTML = `<option value="">— оружие —</option>
        <optgroup label="Простое">${weapons.filter(w => w.cat === 'simple').map(opt).join('')}</optgroup>
        <optgroup label="Воинское">${weapons.filter(w => w.cat === 'martial').map(opt).join('')}</optgroup>`;
      el.weaponList.innerHTML = state.weapons.map((k, i) => {
        const w = weapons.find(x => x.key === k);
        return w ? `<label>${esc(w.rus)} <button type="button" class="linkish" data-remove-weapon="${i}" aria-label="Убрать">×</button></label>` : '';
      }).join('');
    });

    // Money and inventory.
    document.querySelectorAll('[data-money]').forEach(input => {
      if (document.activeElement !== input) input.value = state.money[input.dataset.money] || '';
    });
    renderSection('inventory', JSON.stringify(state.inventory), () => {
      el.inventoryList.innerHTML = state.inventory.map((it, i) => `<div class="pickRow invRow">
        <input value="${esc(it.name)}" data-inv-name="${i}" maxlength="120" aria-label="Предмет">
        <input type="number" min="0" value="${it.qty}" data-inv-qty="${i}" class="qty" aria-label="Количество">
        <button type="button" class="linkish" data-remove-item="${i}" aria-label="Убрать">×</button></div>`).join('')
        || '<p class="hint">Пусто.</p>';
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

    const classLine = !cls ? `Персонаж ${c.CL} уровня`
      : c.multi
        ? `${c.entries.map(e => `${esc(rus(e.cls))}${e.subclass ? ` (${esc(rus(e.subclass))})` : ''} ${e.level}`).join(' / ')} · уровень ${c.CL}`
        : `${esc(rus(cls))}${subclass ? ` (${esc(rus(subclass))})` : ''}, ${s.level} уровень`;
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

    // Proficient: +PB; expertise: +2×PB; Jack of All Trades: +½PB on the rest.
    const skillValue = skill => c.mods[skill.ability]
      + (c.expertise.has(skill.value) ? 2 * c.pb : c.skills.has(skill.value) ? c.pb : c.halfPb);
    const skillRows = lists.skills.map(skill => {
      const prof = c.skills.has(skill.value);
      const exp = c.expertise.has(skill.value);
      return `<li${exp ? ' title="Компетентность"' : ''}><span class="pip${prof ? ' on' : ''}${exp ? ' exp' : ''}"></span><span class="val">${signed(skillValue(skill))}</span> ${esc(skill.label)}<span class="abil">${ABILITY[skill.ability]?.short || ''}</span></li>`;
    }).join('');
    const perception = lists.skills.find(x => x.value === 'PERCEPTION');
    const passive = 10 + (perception ? skillValue(perception) : c.mods.WISDOM) + c.mech.passiveBonus;

    const prof = cls?.proficiency || {};
    // Class tool text may carry TTG markup (2014 "{@item …}"); background/choice tools are names.
    const toolParts = [
      ...String(prof.tool || '').split(/[;,]\s*/),
      ...(background?.toolProficiencies || []).map(t => {
        const item = (background.startingEquipment || []).flatMap(o => o.items || []).find(i => i.url === t.url);
        return item?.name || t.url;
      }),
      ...(background?.toolMarkup || []).flatMap(m => m.split(/,\s*/)),
      ...c.chosenTools,
    ].map(x => x.trim().replace(/\.$/, '')).filter(Boolean);
    // One entry per tool, compared by visible text (class and background often both give one).
    const seenTools = new Set();
    const tools = [];
    for (const part of toolParts) {
      const html = inline(part);
      const text = html.replace(/<[^>]+>/g, '').toLowerCase();
      if (seenTools.has(text)) continue;
      seenTools.add(text);
      tools.push(text.includes('воровские инструменты') && c.toolExpertise.has('THIEVES_TOOLS') ? `${html} <span class="tag always">компетентность</span>` : html);
    }
    const languages = [s.languages, ...c.chosenLanguages].filter(Boolean).join(', ');

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
    const classFeatureHtml = c.classFeatures.map((f, i) => feature(`c-${f.entryKey}-${f.key || i}-${f.level}`, f.name, f.level, f.description,
      [f.classTag, f.isSubclass ? 'подкласс' : f.optional ? 'опционально' : ''].filter(Boolean).join(' · '))).join('')
      // Picked options (invocations, metamagic, maneuvers, …). 2014 ones load their text on demand.
      + c.chosenOptions.map(({ choice, option }) => option.description?.length
        ? feature(`o-${choice.key}-${option.key}`, rus(option), choice.level, option.description, choice.title)
        : `<div class="feature optionRow"><span>${esc(rus(option))}</span> <span class="tag">${esc(choice.title)}</span>
            <button type="button" class="linkish" data-option-info="${esc(choice.key)}|${esc(option.key)}">описание</button></div>`).join('');
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
          <table class="spellTable"><tr><th>Ур.</th><th>Название</th><th>Школа</th><th>Сл / атака</th><th>Источник</th></tr>${rows.map(x => {
            const st = c.extraStats[x.sourceKey];
            return `
            <tr><td>${x.level || 'з'}</td>
              <td><button type="button" class="linkish" data-spell-info="${esc(x.url)}">${esc(rus(x))}</button></td>
              <td>${esc(x.school || '')}</td>
              <td>${st ? `${st.dc} / ${signed(st.attack)} <span class="muted">${esc(ABILITY[st.key]?.short || '')}</span>` : '—'}</td>
              <td><span class="tag always">${esc(x.sourceTag || '')}</span> ${esc(x.alwaysFrom || '')}</td></tr>`;
          }).join('')}</table>
        </section>`;
    }
    // One section per casting class; shared multiclass slots are shown once, on the first.
    let sharedShown = false;
    for (const sp of c.casters) {
      let slotHtml = sp.pact
        ? `<div class="slot"><b>${sp.pact.count}</b>ячейки ${sp.pact.level} ур.</div>`
        : sp.slotsRow.map((n, i) => `<div class="slot"><b>${n}</b>${i + 1} ур.</div>`).join('');
      if (sp.sharedSlots) {
        slotHtml = sharedShown ? '<p class="hint">Ячейки общие для классов (см. выше).</p>'
          : `${slotHtml}<p class="hint">Общие ячейки мультикласса: уровень заклинателя ${sp.sharedSlots}.</p>`;
        sharedShown = true;
      }
      const rows = [...sp.cantrips, ...sp.leveled, ...sp.always].sort((a, b) => a.level - b.level || rus(a).localeCompare(rus(b), 'ru'));
      spellHtml += `
        <section class="box">
          <h3>Заклинания${c.casters.length > 1 ? ` · ${esc(sp.label)}` : ''} · ${esc(CASTER_NAMES[sp.type] || '')}</h3>
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
      // 2014: equipment is text; show the chosen alternative of each "а) … или б) …" line.
      cls?.equipmentMarkup?.length ? (() => {
        const { lines, notes } = equipmentLines14(cls.equipmentMarkup);
        return `<dt>Класс</dt><dd><ul class="plainList">${lines.map((line, i) =>
          `<li>${inline(line.options[s.equip14[i] ?? 0] || line.options[0] || '')}</li>`).join('')}</ul>${notes.length ? rich(notes) : ''}</dd>`;
      })() : '',
      background?.equipmentMarkup?.length ? `<dt>Предыстория</dt><dd>${background.equipmentMarkup.map(inline).join(', ')}</dd>` : '',
      s.inventory.length ? `<dt>Инвентарь</dt><dd><ul class="plainList">${s.inventory.map(it =>
        `<li>${esc(it.name)}${it.qty !== 1 ? ` ×${it.qty}` : ''}</li>`).join('')}</ul></dd>` : '',
      Object.values(s.money).some(Boolean) ? `<dt>Деньги</dt><dd>${[['pp', 'пм'], ['gp', 'зм'], ['ep', 'эм'], ['sp', 'см'], ['cp', 'мм']]
        .filter(([k]) => s.money[k]).map(([k, label]) => `${s.money[k]} ${label}`).join(', ')}</dd>` : '',
    ].join('');

    const attackHtml = `
      <section class="box">
        <h3>Атаки</h3>
        <div class="spellTableWrap"><table class="spellTable attackTable">
          <tr><th>Оружие</th><th>Атака</th><th>Урон</th><th>Свойства</th></tr>
          ${c.attacks.rows.map(a => `<tr${a.prof ? '' : ' class="noProf" title="Нет владения: бонус мастерства не добавлен"'}>
            <td>${esc(a.name)}${a.prof ? '' : ' <span class="tag">без владения</span>'}${a.mastery ? ` <span class="tag always" title="Оружейный приём">${esc(a.mastery)}</span>` : ''}</td>
            <td><b>${signed(a.attack)}</b> <span class="muted">${esc(ABILITY[a.ability]?.short || '')}</span></td>
            <td>${esc(a.damage)}${a.versatile ? ` <span class="muted">(двумя руками ${esc(a.versatile)})</span>` : ''}</td>
            <td class="muted">${esc([...a.props, ...a.notes].join(', '))}</td></tr>`).join('')}
        </table></div>
        ${state.weapons.length ? '' : '<p class="hint">Добавьте оружие в разделе «Снаряжение» конструктора.</p>'}
      </section>`;

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
          <div class="fact"><span>Кость хитов</span><b>${c.hitDice.length ? c.hitDice.map(h => `${h.level}${esc(h.die.label)}`).join(' + ') : '—'}</b></div>
          <div class="fact"><span>Бонус мастерства</span><b>${signed(c.pb)}</b></div>
          <div class="fact"><span>Пасс. внимательность</span><b>${passive}</b></div>
        </div>
      </header>

      <div class="abilities">${abilities}</div>

      <div class="combat">
        <div class="stat"><b>${c.ac}</b><span>Класс доспеха</span><small>${esc(c.acNote)}</small></div>
        <div class="stat"><b>${c.hp || '—'}</b><span>Хиты</span><small>${s.hpMode === 'manual' && c.hp !== c.hpCalculated ? `вручную (расчёт ${c.hpCalculated})`
          : s.hpMode === 'rolled' ? 'по броскам' : c.multi ? 'по костям хитов классов' : c.hd ? `${c.hd.maxValue} + ${esc(c.hd.label)} за уровень` : ''}</small></div>
        <div class="stat"><b>${signed(c.init)}</b><span>Инициатива</span><small>${c.initPB ? 'с бонусом мастерства' : ''}</small></div>
        <div class="stat"><b>${c.speed}</b><span>Скорость, фт.</span><small>${esc([...c.speedNotes, ...movement.slice(1)].join(', '))}</small></div>
      </div>
      ${c.warnings.length ? `<p class="hint warn">${c.warnings.map(esc).join('. ')}</p>` : ''}
      ${attackHtml}

      <div class="columns">
        <div>
          <section class="box"><h3>Спасброски</h3><ul class="list">${saveRows}</ul></section>
          <section class="box"><h3>Навыки</h3><ul class="list">${skillRows}</ul></section>
          <section class="box"><h3>Владения</h3>
            <dl class="kv">
              <dt>Доспехи</dt><dd>${esc(prof.armor || '—')}</dd>
              <dt>Оружие</dt><dd>${esc(prof.weapon || '—')}</dd>
              <dt>Инструменты</dt><dd>${tools.join(', ') || '—'}</dd>
              <dt>Языки</dt><dd>${esc(languages || '—')}</dd>
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
    renderRoster(); // names and levels in the character selector
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
    renderRoster();
  });
  $('addWeaponBtn').addEventListener('click', () => {
    const key = el.weaponSelect.value;
    if (key) setAndUpdate({ weapons: [...state.weapons, key] });
  });
  $('addItemBtn').addEventListener('click', () => {
    const name = el.itemName.value.trim();
    if (!name) return;
    el.itemName.value = '';
    setAndUpdate({ inventory: [...state.inventory, { name: name.slice(0, 120), qty: clampInt(el.itemQty.value, 1, 9999, 1) }] });
  });
  // Copies the chosen starting equipment into the inventory and adds its coins to money.
  $('startGearBtn').addEventListener('click', () => {
    const plain = markup => { const d = document.createElement('div'); d.innerHTML = inline(markup); return d.textContent.trim(); };
    const items = [];
    const money = { ...state.money };
    const fromOption = option => {
      for (const it of option?.items || []) items.push({ name: it.name || it.url, qty: it.quantity || 1 });
      if (option?.coins) money.gp += option.coins; // TTG gives starting coins in gold
    };
    fromOption(data.cls?.startingEquipment?.[state.classEquip]);
    fromOption(data.background?.startingEquipment?.[state.bgEquip]);
    if (data.cls?.equipmentMarkup?.length) {
      equipmentLines14(data.cls.equipmentMarkup).lines.forEach((line, i) => {
        const text = plain(line.options[state.equip14[i] ?? 0] || line.options[0] || '');
        if (text) items.push({ name: text.slice(0, 120), qty: 1 });
      });
    }
    for (const m of data.background?.equipmentMarkup || []) {
      const text = plain(m).replace(/\.$/, '');
      if (text && !/зм\.?$/i.test(text)) items.push({ name: text.slice(0, 120), qty: 1 });
    }
    if (data.background?.startGold) money.gp += data.background.startGold;
    if (!items.length && money.gp === state.money.gp) return setStatus('Стартового снаряжения нет — выберите класс и предысторию');
    setAndUpdate({ inventory: [...state.inventory, ...items], money });
    setStatus(`Добавлено в инвентарь: ${items.length}`);
  });

  el.addClassBtn.addEventListener('click', () => {
    if (state.multiclass.length >= 3 || charLevel() >= 20) return;
    setAndUpdate({ multiclass: [...state.multiclass, { classUrl: '', subclassUrl: '', level: 1, spells: [] }] });
  });
  el.level.addEventListener('change', () => {
    const others = state.multiclass.reduce((n, m) => n + (m.classUrl ? m.level : 0), 0);
    state.level = clampInt(el.level.value, 1, Math.max(1, 20 - others), 1);
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
    // Extra classes: the class, its subclass and its spells.
    state.multiclass = state.multiclass.map((m, i) => {
      const mcClass = find(lists.classes, m.classUrl);
      if (bad(mcClass)) { removed.push(rus(mcClass)); return { ...m, classUrl: '', subclassUrl: '', spells: [] }; }
      const entry = (data.entries || []).find(e => e.key === `mc${i}`);
      let next = m;
      const mcSub = entry && find(entry.subclasses, m.subclassUrl);
      if (m.subclassUrl && bad(mcSub)) { removed.push(rus(mcSub)); next = { ...next, subclassUrl: '' }; }
      const pool = entry ? spellPool(entry) : [];
      const kept = m.spells.filter(url => !bad(find(pool, url)));
      if (kept.length !== m.spells.length) { removed.push(`заклинания: ${m.spells.length - kept.length}`); next = { ...next, spells: kept }; }
      return next;
    });

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

    const featPool = Object.values(data.featLists).flat();
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
      // Picks go to the class selected in the caster switch.
      const set = new Set(spellPicksOf(activeCaster));
      t.checked ? set.add(t.dataset.spell) : set.delete(t.dataset.spell);
      return setSpellPicks(activeCaster, [...set]);
    }
    if (t.dataset.filterLevel != null) {
      const lvl = Number(t.dataset.filterLevel);
      t.checked ? spellFilter.levels.add(lvl) : spellFilter.levels.delete(lvl);
    } else if (t.dataset.filterSchool != null) {
      t.checked ? spellFilter.schools.add(t.dataset.filterSchool) : spellFilter.schools.delete(t.dataset.filterSchool);
    } else if (t.name === 'filterConc') {
      spellFilter.conc = t.value;
    } else if (t.name === 'filterRitual') {
      spellFilter.ritual = t.value;
    } else {
      const flags = { filterNoV: 'noV', filterNoS: 'noS', filterNoM: 'noM', filterChosen: 'chosen', filterAvailable: 'available' };
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
    if (t.dataset.equip14 != null) return setAndUpdate({ equip14: { ...state.equip14, [t.dataset.equip14]: Number(t.value) } });
    if (t.dataset.money) return setAndUpdate({ money: { ...state.money, [t.dataset.money]: clampInt(t.value, 0, 9999999, 0) } });
    if (t.dataset.invName != null || t.dataset.invQty != null) {
      const i = Number(t.dataset.invName ?? t.dataset.invQty);
      const inventory = state.inventory.map((it, j) => (j !== i ? it
        : t.dataset.invName != null ? { ...it, name: t.value.slice(0, 120) } : { ...it, qty: clampInt(t.value, 0, 9999, 1) }));
      return setAndUpdate({ inventory });
    }
    if (t.name === 'hpMode') return setAndUpdate({ hpMode: t.value });
    if (t.dataset.hpRoll) return setAndUpdate({ hpRolls: { ...state.hpRolls, [t.dataset.hpRoll]: Number(t.value) } });
    if (t.dataset.hpManual != null) return setAndUpdate({ hpManual: t.value === '' ? null : Number(t.value) });
    if (t.dataset.mcField) {
      const i = Number(t.dataset.mc);
      const field = t.dataset.mcField;
      const others = state.level + state.multiclass.reduce((n, m, j) => n + (j !== i && m.classUrl ? m.level : 0), 0);
      const multiclass = state.multiclass.map((m, j) => {
        if (j !== i) return m;
        if (field === 'classUrl') return { ...m, classUrl: t.value, subclassUrl: '', spells: [] };
        if (field === 'level') return { ...m, level: clampInt(t.value, 1, Math.max(1, 20 - others), 1) };
        return { ...m, [field]: t.value };
      });
      return setAndUpdate({ multiclass });
    }
    if (t.dataset.optional) {
      const optionalFeatures = { ...state.optionalFeatures };
      if (t.checked) optionalFeatures[t.dataset.optional] = true;
      else delete optionalFeatures[t.dataset.optional];
      return setAndUpdate({ optionalFeatures });
    }
    if (t.dataset.choice) {
      const list = [...(state.choices[t.dataset.choice] || [])];
      list[Number(t.dataset.index)] = t.value;
      return setAndUpdate({ choices: { ...state.choices, [t.dataset.choice]: list } });
    }
    if (t.dataset.choiceCheck) {
      const key = t.dataset.choiceCheck;
      const set = new Set((state.choices[key] || []).filter(Boolean));
      t.checked ? set.add(t.value) : set.delete(t.value);
      return setAndUpdate({ choices: { ...state.choices, [key]: [...set] } });
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
    const t = event.target.closest('[data-action], [data-spell-info], [data-feat-info], [data-option-info], [data-mc-remove], [data-caster], [data-remove-weapon], [data-remove-item]');
    if (!t) return;
    if (t.dataset.removeWeapon != null) {
      const i = Number(t.dataset.removeWeapon);
      return setAndUpdate({ weapons: state.weapons.filter((_, j) => j !== i) });
    }
    if (t.dataset.removeItem != null) {
      const i = Number(t.dataset.removeItem);
      return setAndUpdate({ inventory: state.inventory.filter((_, j) => j !== i) });
    }
    if (t.dataset.mcRemove != null) {
      const i = Number(t.dataset.mcRemove);
      return setAndUpdate({ multiclass: state.multiclass.filter((_, j) => j !== i) });
    }
    if (t.dataset.caster) { activeCaster = t.dataset.caster; rendered.spellRows = ''; rendered.spellChips = ''; return rerenderSpells(); }
    if (t.dataset.optionInfo) { event.preventDefault(); return showOption(t.dataset.optionInfo); }
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
    if (t.dataset.action === 'roll-hp' && lastComputed) {
      const hpRolls = { ...state.hpRolls };
      for (const x of lastComputed.hpLevels) hpRolls[x.key] = 1 + Math.floor(Math.random() * x.die.maxValue);
      return setAndUpdate({ hpRolls });
    }
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
  // "choiceKey|optionKey": 2024 options carry their text; 2014 ones are fetched on demand.
  function showOption(ref) {
    const [choiceKey, optionKey] = ref.split('|');
    const choice = (lastComputed?.choices || []).find(ch => ch.key === choiceKey);
    const option = choice?.options?.find(o => o.key === optionKey);
    if (!option) return;
    showDetail(async () => (option.description?.length ? option : (await P.loadOption(option.url || option.key)) || option), o => `
      <h2>${esc(rus(o))}</h2>
      <p class="hint">${esc(choice.title)}${o.prerequisite?.length ? ` · Требование: ${esc(o.prerequisite.join('; '))}` : ''}</p>
      ${o.description?.length ? rich(o.description) : '<p class="muted">Описание недоступно.</p>'}`);
  }

  function showFeat(url) {
    showDetail(() => P.loadFeat(url), f => `<h2>${esc(rus(f))}</h2>
      <p class="hint">${esc(f.category || '')}${f.prerequisite ? ` · Требование: ${esc(f.prerequisite)}` : ''} · ${esc(f.source?.name?.label || '')}</p>
      ${rich(f.description)}`);
  }

  // ---------- roster actions ----------

  const fileName = ext => `${(state.name || 'персонаж').replace(/[\\/:*?"<>|]+/g, '_')}.${ext}`;
  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function renderRoster() {
    const box = roster[edition];
    const items = Object.entries(box.items).sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0));
    el.rosterSelect.innerHTML = items.map(([id, item]) =>
      `<option value="${esc(id)}"${id === box.active ? ' selected' : ''}>${esc(rosterLabel(id === box.active ? state : item.state || {}))}</option>`).join('');
    $('deleteBtn').disabled = false;
  }

  // Shows another character of the current edition.
  function activateCharacter(id) {
    if (!roster[edition].items[id]) return;
    save();
    roster[edition].active = id;
    state = loadState(edition);
    generation++;
    Object.keys(rendered).forEach(k => delete rendered[k]);
    activeCaster = 'main';
    fillMainSelects();
    syncStaticInputs();
    renderRoster();
    update();
  }

  // Adds a character to the roster of an edition and shows it.
  async function addCharacter(ed, characterState) {
    save();
    const id = newId();
    roster[ed].items[id] = { state: normalizeState(characterState), updatedAt: Date.now() };
    roster[ed].active = id;
    if (ed !== edition) {
      await switchEdition(ed); // loads the active (new) character of that edition
    } else {
      state = loadState(edition);
      generation++;
      Object.keys(rendered).forEach(k => delete rendered[k]);
      fillMainSelects();
      syncStaticInputs();
      renderRoster();
      await update(); // so a following status message is not overwritten
    }
  }

  el.rosterSelect.addEventListener('change', () => activateCharacter(el.rosterSelect.value));
  $('newBtn').addEventListener('click', () => addCharacter(edition, null));
  $('copyBtn').addEventListener('click', () => addCharacter(edition, { ...JSON.parse(JSON.stringify(state)), name: `${state.name || 'Безымянный герой'} (копия)` }));
  $('deleteBtn').addEventListener('click', () => {
    if (!window.confirm(`Удалить «${state.name || 'Безымянный герой'}»? Это нельзя отменить (сначала можно сделать экспорт).`)) return;
    const box = roster[edition];
    delete box.items[box.active];
    if (!Object.keys(box.items).length) { const id = newId(); box.items[id] = { state: defaultState(), updatedAt: Date.now() }; }
    box.active = Object.entries(box.items).sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0))[0][0];
    state = loadState(edition); // the deleted one must not be saved back
    try { localStorage.setItem(ROSTER_KEY, JSON.stringify(roster)); } catch { /* storage blocked */ }
    activateCharacter(box.active);
  });

  $('exportBtn').addEventListener('click', () => {
    download(new Blob([JSON.stringify({ ...state, edition }, null, 2)], { type: 'application/json' }), fileName('json'));
  });
  $('importInput').addEventListener('change', async event => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text());
      // Exports before the edition switch carry no edition and are 2024 characters.
      const target = raw.edition === '2014' ? '2014' : '2024';
      delete raw.edition;
      await addCharacter(target, raw); // imported characters are added, never overwrite
      setStatus('Персонаж импортирован');
    } catch {
      setStatus('Файл не похож на сохранённого персонажа', true);
    }
  });
  $('printBtn').addEventListener('click', () => window.print());

  // ---------- share link: the character, compressed, in the URL hash ----------

  const toB64url = bytes => {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const fromB64url = text => Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), ch => ch.charCodeAt(0));

  async function encodeShare(payload) {
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    if (!('CompressionStream' in window)) return `j${toB64url(bytes)}`;
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    return `z${toB64url(new Uint8Array(await new Response(stream).arrayBuffer()))}`;
  }
  async function decodeShare(code) {
    const bytes = fromB64url(code.slice(1));
    if (code[0] === 'j') return JSON.parse(new TextDecoder().decode(bytes));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return JSON.parse(await new Response(stream).text());
  }

  $('shareBtn').addEventListener('click', async () => {
    const url = `${location.origin}${location.pathname}#c=${await encodeShare({ e: edition, s: state })}`;
    try {
      await navigator.clipboard.writeText(url);
      setStatus('Ссылка на персонажа скопирована');
    } catch {
      showDetail(async () => url, u => `<h2>Ссылка на персонажа</h2>
        <p class="hint">Скопируйте ссылку — по ней откроется копия этого персонажа.</p>
        <input value="${esc(u)}" readonly onfocus="this.select()">`);
    }
  });

  // A shared character in the URL is added to the roster (never replaces one).
  async function importFromHash() {
    const m = /^#c=([jz][A-Za-z0-9_-]+)$/.exec(location.hash);
    if (!m) return false;
    history.replaceState(null, '', location.pathname + location.search);
    try {
      const payload = await decodeShare(m[1]);
      await addCharacter(payload.e === '2024' ? '2024' : '2014', payload.s);
      setStatus('Персонаж из ссылки добавлен в список');
      return true;
    } catch {
      setStatus('Ссылка повреждена — персонажа не удалось открыть', true);
      return false;
    }
  }

  // ---------- PDF / Word ----------

  // A light, static copy of the sheet without the long feature descriptions.
  function exportCopy() {
    const holder = document.createElement('div');
    holder.className = 'exportSheet';
    holder.innerHTML = el.sheet.innerHTML;
    holder.querySelectorAll('.rich, button.linkish[data-option-info]').forEach(x => x.remove());
    holder.querySelectorAll('details').forEach(d => d.removeAttribute('open'));
    return holder;
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if ([...document.scripts].some(s => s.src === src)) return resolve();
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('script'));
      document.head.appendChild(s);
    });
  }

  $('pdfBtn').addEventListener('click', async () => {
    setStatus('Готовлю PDF…');
    try {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js');
      const holder = exportCopy();
      const stage = document.createElement('div');
      stage.className = 'exportStage';
      stage.appendChild(holder);
      document.body.appendChild(stage);
      await window.html2pdf().set({
        margin: 8, filename: fileName('pdf'),
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'], avoid: ['.box', '.ability', '.stat', 'tr'] },
      }).from(holder).save();
      stage.remove();
      setStatus('PDF сохранён');
    } catch {
      setStatus('Не удалось создать PDF — можно воспользоваться «Печать» → «Сохранить как PDF»', true);
    }
  });

  // Word opens HTML saved with the .doc extension; keep the styling simple and inline.
  $('docBtn').addEventListener('click', () => {
    const holder = exportCopy();
    holder.querySelectorAll('details summary').forEach(s => { s.outerHTML = `<p>${s.innerHTML}</p>`; });
    const css = `body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#000}
      h3{font-size:12pt;margin:12pt 0 4pt;text-transform:uppercase}
      table{border-collapse:collapse}td,th{border:1px solid #999;padding:2pt 4pt;font-size:10pt}
      .ability,.stat,.fact{display:inline-block;border:1px solid #999;padding:4pt;margin:2pt;min-width:60pt;text-align:center}
      .tag{border:1px solid #999;padding:0 3pt;font-size:8pt}.muted,.hint{color:#555}`;
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
      <head><meta charset="utf-8"><title>${esc(state.name || 'Персонаж')}</title><style>${css}</style></head>
      <body>${holder.innerHTML}</body></html>`;
    download(new Blob(['﻿', html], { type: 'application/msword' }), fileName('doc'));
    setStatus('Документ Word сохранён');
  });

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
    Object.assign(lists, { feats: [], sourceList: [], spellFlags: {} }, editionLists[edition]);
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
      background: null, feats: {}, featLists: {}, entries: [], spells: [], spellsKey: '', granted: [],
      spellSources: [], spellCandidates: {},
    });
    Object.keys(rendered).forEach(k => delete rendered[k]);
    spellFilter = defaultSpellFilter();
    activeCaster = 'main';
    syncSpellFilterInputs();
    setStatus('Загрузка…');
    syncStaticInputs();
    await loadEditionLists();
    syncStaticInputs();
    fillMainSelects();
    renderRoster();
    if (!skipUpdate) await update();
  }

  // ---------- init ----------

  async function init() {
    el.armor.innerHTML = ARMORS.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('');
    syncStaticInputs();
    let tab = 'builder';
    try { tab = localStorage.getItem(TAB_KEY) === 'spells' ? 'spells' : 'builder'; } catch { /* storage blocked */ }
    setTab(tab);
    // Damage/condition names are the same in both editions; take them from the core-api.
    const [damage, conditions, languages] = await Promise.all([
      fetchJson('/api/dnd/dictionaries/damage/types', () => coreDirect('dictionaries/damage/types')).catch(() => []),
      fetchJson('/api/dnd/dictionaries/conditions', () => coreDirect('dictionaries/conditions')).catch(() => []),
      fetchJson('/api/dnd/dictionaries/languages', () => coreDirect('dictionaries/languages')).catch(() => []),
      loadEditionLists(),
    ]);
    lists.languages = Object.fromEntries((Array.isArray(languages) ? languages : [])
      .map(x => [x.value, x.label]).sort((a, b) => a[1].localeCompare(b[1], 'ru')));
    const toDict = arr => Object.fromEntries((Array.isArray(arr) ? arr : []).map(x => [x.value, (x.label || x.name || '').toLowerCase()]));
    lists.damage = toDict(damage);
    lists.conditions = toDict(conditions);
    syncStaticInputs();
    fillMainSelects();
    renderRoster();
    // A shared link adds its character and shows it; otherwise show the active one.
    if (!(await importFromHash())) update();
  }

  init();
})();
