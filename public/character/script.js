(() => {
  'use strict';

  // All compendium data comes from the TTG Club core-api via our cached proxy.
  const API = '/api/dnd/';
  const STORAGE_KEY = 'mg-dnd-character-v1';

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
      name: '', level: 1, alignment: '', officialOnly: false,
      classUrl: '', subclassUrl: '', speciesUrl: '', lineageUrl: '', backgroundUrl: '',
      abilityMethod: 'standard',
      standard: { STRENGTH: 15, DEXTERITY: 14, CONSTITUTION: 13, INTELLIGENCE: 12, WISDOM: 10, CHARISMA: 8 },
      pointbuy: Object.fromEntries(ABILITIES.map(a => [a.key, 8])),
      manual: Object.fromEntries(ABILITIES.map(a => [a.key, 10])),
      bgMode: '2-1', bgPlus2: '', bgPlus1: '',
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
    return s;
  }

  let state = defaultState();
  try { state = normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY))); } catch { /* fresh start */ }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* storage blocked */ }
  }

  // ---------- data ----------

  const requestCache = new Map();
  function api(path) {
    if (!requestCache.has(path)) {
      const p = fetch(API + path).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      });
      p.catch(() => requestCache.delete(path));
      requestCache.set(path, p);
    }
    return requestCache.get(path);
  }

  const lists = { classes: [], species: [], backgrounds: [], skills: FALLBACK_SKILLS, damage: {}, conditions: {} };
  const data = {
    cls: null, subclasses: [], subclass: null, eff: null,
    species: null, lineages: [], lineage: null,
    background: null, feats: {}, featLists: { general: [], epic: [] },
    spells: [], spellsKey: '',
  };

  async function loadData() {
    const s = state;
    const speciesShort = lists.species.find(x => x.url === s.speciesUrl);
    const [cls, subclasses, species, lineages, background] = await Promise.all([
      s.classUrl ? api(`classes/${s.classUrl}`) : null,
      s.classUrl ? api(`classes/${s.classUrl}/subclasses`).catch(() => []) : [],
      s.speciesUrl ? api(`species/${s.speciesUrl}`) : null,
      speciesShort && speciesShort.hasLineages ? api(`species/${s.speciesUrl}/lineages`).catch(() => []) : [],
      s.backgroundUrl ? api(`backgrounds/${s.backgroundUrl}`) : null,
    ]);
    data.cls = cls;
    data.subclasses = Array.isArray(subclasses) ? subclasses : [];
    data.species = species;
    data.lineages = Array.isArray(lineages) ? lineages : [];
    data.lineage = data.lineages.find(x => x.url === s.lineageUrl) || null;
    data.background = background;

    const subclassOpen = cls && s.subclassUrl && s.level >= (cls.subclassLevel || 3)
      && data.subclasses.some(x => x.url === s.subclassUrl);
    data.subclass = subclassOpen ? await api(`classes/${s.subclassUrl}`) : null;
    // Subclass detail already merges the parent's features and carries its own casting table.
    data.eff = data.subclass || cls;

    const slots = featSlots();
    const featUrls = [...new Set(slots.map(slot => slotFeatUrl(slot)).filter(Boolean))];
    const needGeneral = slots.some(x => !x.fixed);
    const needEpic = slots.some(x => x.epic);
    const [general, epic, ...featDetails] = await Promise.all([
      needGeneral ? api('feats/search?category=GENERAL').catch(() => []) : [],
      needEpic ? api('feats/search?category=EPIC_BOON').catch(() => []) : [],
      ...featUrls.map(url => api(`feats/${url}`).catch(() => null)),
    ]);
    data.featLists = { general: sortByName(general), epic: sortByName(epic) };
    data.feats = {};
    featUrls.forEach((url, i) => { if (featDetails[i]) data.feats[url] = featDetails[i]; });

    const spellKey = spellListKey();
    if (spellKey !== data.spellsKey) {
      data.spells = spellKey ? sortByName(await api(spellKey)) : [];
      data.spellsKey = spellKey;
    }
  }

  function spellListKey() {
    const { cls, subclass, eff } = data;
    if (!eff || !isCasterType(eff.casterType)) return '';
    // Subclass-only casters (Eldritch Knight, Arcane Trickster) have their own spell list on TTG.
    if (subclass && !isCasterType(cls.casterType)) return `spells/search?subclassName=${subclass.url}`;
    return `spells/search?className=${cls.url}`;
  }

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
  // TTG groups sources as Basic (official), UA (playtest) and 3rd (third-party).
  const isOfficial = item => item?.source?.group?.label === 'Basic';
  const isAllowed = item => !state.officialOnly || isOfficial(item);
  const GROUP_ORDER = { Basic: 0, UA: 1, '3rd': 2 };
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
    if (state.backgroundUrl) {
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
      slots.push({ key, level: f.level, title: `${f.name} · ${f.level} ур.`, epic });
    }
    return slots;
  }
  function slotFeatUrl(slot) {
    return slot.fixed || state.feats[slot.key]?.url || '';
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
    if (background) {
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
      initPB: false, skills: new Set(), saves: new Set(), counters: [],
    };
    const addMech = (m, acquired, from) => {
      if (!m) return;
      const mo = m.modifiers || {};
      if (mo.hitPoints && (mo.hitPoints.perAcquisitionLevel || mo.hitPoints.perLevelAfterAcquisition)) {
        mech.hp += (mo.hitPoints.perAcquisitionLevel || 0) + (mo.hitPoints.perLevelAfterAcquisition || 0) * Math.max(0, L - acquired);
      }
      for (const sense of mo.senses || []) {
        if (sense?.type) mech.senses[sense.type] = Math.max(mech.senses[sense.type] || 0, sense.range || 0);
      }
      (mo.damage?.resistances || []).forEach(x => mech.resist.add(x));
      (mo.damage?.immunities || []).forEach(x => mech.immune.add(x));
      (mo.damage?.vulnerabilities || []).forEach(x => mech.vuln.add(x));
      (mo.conditionImmunities || []).forEach(x => mech.condImm.add(typeof x === 'string' ? x : x?.type));
      if (mo.initiativeProficiencyBonus) mech.initPB = true;
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
    const bgSkills = bgSkillText.split(/,\s*/).map(skillByLabel).filter(Boolean).map(x => x.value);
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
    if (armor.id === 'none') {
      ac = 10 + mods.DEXTERITY;
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
    let spell = null;
    if (eff && isCasterType(eff.casterType) && L >= (eff.spellcastingStartLevel || 1)) {
      let slotsRow = [];
      let pact = null;
      if (eff.casterType === 'PACT') {
        pact = { count: PACT_SLOT_COUNT[L - 1], level: Math.min(5, Math.ceil(L / 2)) };
      } else {
        const divisor = eff.casterType === 'HALF' ? 2 : eff.casterType === 'THIRD' ? 3 : 1;
        slotsRow = FULL_SLOTS[Math.max(1, Math.ceil(L / divisor)) - 1] || [];
      }
      const maxLevel = pact ? pact.level : slotsRow.length;
      const abilityKey = eff.spellcastingAbility;
      const abilityMod = mods[abilityKey] ?? 0;
      const cantripLimit = Number(scalingValue(tableColumn(eff, 'CANTRIPS_KNOWN'), L)) || 0;
      const preparedRaw = scalingValue(tableColumn(eff, 'PREPARED_SPELLS'), L);
      const preparedLimit = preparedRaw == null ? null : Number(preparedRaw) || 0;
      const chosen = data.spells.filter(sp => s.spells.includes(sp.url));
      const cantrips = chosen.filter(sp => sp.level === 0);
      const leveled = chosen.filter(sp => sp.level > 0 && sp.level <= maxLevel);
      spell = {
        type: eff.casterType, abilityKey, abilityMod,
        dc: 8 + pb + abilityMod, attack: pb + abilityMod,
        slotsRow, pact, maxLevel, cantripLimit, preparedLimit, cantrips, leveled,
      };
    }

    // Class resources: every non-spell column of the class table, plus counters from mechanics.
    const resources = [];
    for (const col of eff?.table || []) {
      if (col.purpose === 'CANTRIPS_KNOWN' || col.purpose === 'PREPARED_SPELLS') continue;
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
      init: mods.DEXTERITY + (mech.initPB ? pb : 0), initPB: mech.initPB,
      speed: props.movement?.base || 30, movement: props.movement || {}, size: props.size, creatureType: props.type,
      mech, classFeatures, speciesFeatures, spell, resources,
    };
  }

  function evalCounter(expr, { pb, L, mods }) {
    if (typeof expr === 'number') return expr;
    const text = String(expr ?? '').trim();
    const map = { prof: pb, level: L, str: mods.STRENGTH, dex: mods.DEXTERITY, con: mods.CONSTITUTION, int: mods.INTELLIGENCE, wis: mods.WISDOM, cha: mods.CHARISMA, chr: mods.CHARISMA };
    const replaced = text.replace(/@(\w+)/g, (m, k) => (k in map ? String(map[k]) : m));
    if (/^[\d+\-*/ ().]+$/.test(replaced)) {
      try { return Math.max(1, Math.floor(Function(`"use strict";return (${replaced})`)())); } catch { /* fall through */ }
    }
    return text || '—';
  }

  // ---------- builder UI ----------

  const $ = id => document.getElementById(id);
  const el = {
    status: $('status'), name: $('nameInput'), level: $('levelInput'), alignment: $('alignmentSelect'),
    official: $('officialOnly'), cls: $('classSelect'), subclass: $('subclassSelect'), subclassField: $('subclassField'),
    subclassLabel: $('subclassLabel'), subclassHint: $('subclassHint'), classSkills: $('classSkills'),
    species: $('speciesSelect'), lineage: $('lineageSelect'), lineageField: $('lineageField'),
    background: $('backgroundSelect'), backgroundBonus: $('backgroundBonus'),
    abilityInputs: $('abilityInputs'), abilityHint: $('abilityHint'), featSlots: $('featSlots'),
    spellPanel: $('spellPanel'), spellCounts: $('spellCounts'), spellFilter: $('spellFilter'), spellPicker: $('spellPicker'),
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
    el.species.innerHTML = optionsHtml(lists.species, state.speciesUrl, '— выберите вид —');
    el.background.innerHTML = optionsHtml(lists.backgrounds, state.backgroundUrl, '— выберите предысторию —');
  }

  function syncStaticInputs() {
    el.name.value = state.name;
    el.level.value = state.level;
    el.alignment.value = state.alignment;
    el.official.checked = state.officialOnly;
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
      renderSection('subclass', `${cls.url}|${state.subclassUrl}|${state.officialOnly}`, () => {
        el.subclass.innerHTML = optionsHtml(sortByName(subclasses), state.subclassUrl, '— не выбран —');
      });
      el.subclass.disabled = state.level < lvl;
      el.subclassHint.textContent = state.level < lvl ? `Подкласс открывается на ${lvl} уровне.` : '';
    }

    // Lineage
    el.lineageField.hidden = !lineages.length;
    if (lineages.length) {
      renderSection('lineage', `${state.speciesUrl}|${state.lineageUrl}|${lineages.length}|${state.officialOnly}`, () => {
        el.lineage.innerHTML = `<option value="">— основной вид —</option>${lineages.filter(isAllowed).map(x =>
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

    // Background bonuses
    renderSection('bg', `${background?.url}|${state.bgMode}|${c.bgAbils.join()}`, () => {
      if (!background) { el.backgroundBonus.innerHTML = ''; return; }
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
    renderSpellPicker(c);
    renderEquipmentChoices();
  }

  function renderFeatSlots(c) {
    const signature = JSON.stringify([c.slots.map(sl => [sl.key, slotFeatUrl(sl)]), state.feats, data.featLists.general.length, data.featLists.epic.length, Object.keys(data.feats).length, state.officialOnly]);
    renderSection('feats', signature, () => {
      if (!c.slots.length) {
        el.featSlots.innerHTML = '<p class="hint">Черта появится с предысторией, дополнительные — при улучшении характеристик (обычно 4, 8, 12, 16 и 19 уровни).</p>';
        return;
      }
      el.featSlots.innerHTML = c.slots.map(slot => {
        const url = slotFeatUrl(slot);
        const feat = url ? data.feats[url] : null;
        let picker;
        if (slot.fixed) {
          picker = `<div>${feat ? `<button type="button" class="linkish" data-feat-info="${esc(url)}">${esc(rus(feat))}</button>` : esc(url)}</div>`;
        } else {
          const groups = slot.epic ? [['Эпические черты', data.featLists.epic], ['Общие черты', data.featLists.general]] : [['Общие черты', data.featLists.general]];
          picker = `<select data-feat-slot="${slot.key}"><option value="">— выберите черту —</option>${groups.map(([label, items]) =>
            `<optgroup label="${label}">${items.filter(isAllowed).map(f =>
              `<option value="${esc(f.url)}"${f.url === url ? ' selected' : ''}>${esc(rus(f))} [${esc(f.source?.name?.label || '')}]</option>`).join('')}</optgroup>`).join('')}</select>
            ${feat ? `<button type="button" class="linkish" data-feat-info="${esc(url)}">Описание</button>` : ''}`;
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

  function renderSpellPicker(c) {
    const sp = c.spell;
    el.spellPanel.hidden = !sp;
    if (!sp) return;
    const filter = el.spellFilter.value.trim().toLowerCase();
    renderSection('spells', `${data.spellsKey}|${sp.maxLevel}|${sp.cantripLimit}|${filter}|${state.officialOnly}`, () => {
      const groups = [];
      for (let lvl = sp.cantripLimit ? 0 : 1; lvl <= sp.maxLevel; lvl++) {
        const items = data.spells.filter(x => x.level === lvl
          && isAllowed(x)
          && (!filter || rus(x).toLowerCase().includes(filter) || (x.name?.eng || '').toLowerCase().includes(filter)));
        if (!items.length) continue;
        groups.push(`<h3>${lvl === 0 ? 'Заговоры' : `${lvl} уровень`}</h3>${items.map(x => `
          <label class="spellRow"><input type="checkbox" data-spell="${esc(x.url)}" data-level="${x.level}">
            <button type="button" class="linkish" data-spell-info="${esc(x.url)}">${esc(rus(x))}</button>
            <span class="meta">${esc(x.school || '')}${x.concentration ? ' · К' : ''}${x.ritual ? ' · Р' : ''}</span></label>`).join('')}`);
      }
      el.spellPicker.innerHTML = groups.join('') || '<p class="hint">Заклинания не найдены.</p>';
    });
    const cantripsFull = sp.cantrips.length >= sp.cantripLimit;
    const preparedFull = sp.preparedLimit != null && sp.leveled.length >= sp.preparedLimit;
    el.spellPicker.querySelectorAll('[data-spell]').forEach(box => {
      box.checked = state.spells.includes(box.dataset.spell);
      const full = box.dataset.level === '0' ? cantripsFull : preparedFull;
      box.disabled = !box.checked && full;
      box.closest('.spellRow').classList.toggle('disabled', box.disabled);
    });
    const parts = [];
    if (sp.cantripLimit) parts.push(`Заговоры: ${sp.cantrips.length} / ${sp.cantripLimit}`);
    parts.push(sp.preparedLimit != null ? `Подготовлено: ${sp.leveled.length} / ${sp.preparedLimit}` : `Подготовлено: ${sp.leveled.length}`);
    parts.push(`макс. уровень заклинаний: ${sp.maxLevel}`);
    const over = sp.cantrips.length > sp.cantripLimit || (sp.preparedLimit != null && sp.leveled.length > sp.preparedLimit);
    el.spellCounts.innerHTML = parts.join(' · ') + (over ? ' <span class="warn">— больше лимита, снимите лишние.</span>' : '');
  }

  function renderEquipmentChoices() {
    const { cls, background } = data;
    renderSection('equip', `${cls?.url}|${background?.url}|${state.classEquip}|${state.bgEquip}`, () => {
      const group = (title, options, key, selected) => {
        if (!options?.length) return '';
        return `<div class="choiceGroup"><div class="choiceTitle">${title}</div><div class="chips">${options.map((o, i) =>
          `<label><input type="radio" name="${key}" data-equip="${key}" value="${i}"${i === selected ? ' checked' : ''}> Вариант ${esc(o.label || i + 1)}</label>`).join('')}</div></div>`;
      };
      el.equipment.innerHTML = group('Стартовое снаряжение класса', cls?.startingEquipment, 'classEquip', state.classEquip)
        + group('Снаряжение предыстории', background?.startingEquipment, 'bgEquip', state.bgEquip);
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
    const speciesName = species ? `${esc(rus(species))}${lineage ? ` — ${esc(rus(lineage))}` : ''}` : '—';

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
    const passive = 10 + (perception ? skillValue(perception) : c.mods.WISDOM);

    const prof = cls?.proficiency || {};
    const tools = [prof.tool, ...(background?.toolProficiencies || []).map(t => {
      const item = (background.startingEquipment || []).flatMap(o => o.items || []).find(i => i.url === t.url);
      return item?.name || t.url;
    })].filter(Boolean);

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
    const classFeatureHtml = c.classFeatures.map((f, i) => feature(`c-${f.key || i}-${f.level}`, f.name, f.level, f.description, f.isSubclass ? 'подкласс' : '')).join('');
    const speciesFeatureHtml = c.speciesFeatures.map((f, i) => feature(`s-${i}-${rus(f)}`, rus(f), null, f.description)).join('');
    const featHtml = c.feats.map(({ slot, feat }) => feature(`f-${slot.key}-${feat.url}`, rus(feat), slot.level, feat.description, feat.category)).join('');

    let spellHtml = '';
    if (c.spell) {
      const sp = c.spell;
      const slotHtml = sp.pact
        ? `<div class="slot"><b>${sp.pact.count}</b>ячейки ${sp.pact.level} ур.</div>`
        : sp.slotsRow.map((n, i) => `<div class="slot"><b>${n}</b>${i + 1} ур.</div>`).join('');
      const rows = [...sp.cantrips, ...sp.leveled].sort((a, b) => a.level - b.level || rus(a).localeCompare(rus(b), 'ru'));
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
              <td><button type="button" class="linkish" data-spell-info="${esc(x.url)}">${esc(rus(x))}</button>${x.concentration ? ' <span class="tag">К</span>' : ''}${x.ritual ? ' <span class="tag">Р</span>' : ''}</td>
              <td>${esc(x.school || '')}</td>
              <td>${['v', 's', 'm'].filter(k => x.components?.[k]).map(k => ({ v: 'В', s: 'С', m: 'М' })[k]).join(', ')}</td></tr>`).join('')}</table>`
            : '<p class="muted">Выберите заклинания в конструкторе.</p>'}
        </section>`;
    }

    const equipment = [
      cls?.startingEquipment?.length ? `<dt>Класс (вариант ${esc(cls.startingEquipment[s.classEquip]?.label || '')})</dt><dd>${equipmentText(cls.startingEquipment[s.classEquip])}</dd>` : '',
      background?.startingEquipment?.length ? `<dt>Предыстория (вариант ${esc(background.startingEquipment[s.bgEquip]?.label || '')})</dt><dd>${equipmentText(background.startingEquipment[s.bgEquip])}</dd>` : '',
    ].join('');

    el.sheet.innerHTML = `
      <header class="sheetHeader">
        <div>
          <div class="charName">${esc(s.name || 'Безымянный герой')}</div>
          <div class="charSub">${classLine}</div>
        </div>
        <div class="facts">
          <div class="fact"><span>Вид</span><b>${speciesName}</b></div>
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
              <dt>Инструменты</dt><dd>${esc(tools.join(', ') || '—')}</dd>
              <dt>Языки</dt><dd>${esc(s.languages || '—')}</dd>
            </dl>
          </section>
        </div>
        <div>
          ${traits.length ? `<section class="box"><h3>Особенности</h3><dl class="kv">${traits.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl></section>` : ''}
          ${c.resources.length ? `<section class="box"><h3>Ресурсы</h3><ul class="list">${c.resources.map(r =>
            `<li><span class="val">${esc(r.value)}</span> ${esc(r.name)}${RECOVERY_NAMES[r.recovery] ? `<span class="abil">${RECOVERY_NAMES[r.recovery]}</span>` : ''}</li>`).join('')}</ul></section>` : ''}
          <section class="box"><h3>Умения класса</h3>${classFeatureHtml || '<p class="muted">Выберите класс.</p>'}</section>
          <section class="box"><h3>Черты вида</h3>${speciesFeatureHtml || `<p class="muted">${species ? 'Нет особых черт.' : 'Выберите вид.'}</p>`}</section>
          <section class="box"><h3>Черты</h3>${featHtml || '<p class="muted">Черт пока нет.</p>'}</section>
        </div>
      </div>
      ${spellHtml}
      ${equipment ? `<section class="box"><h3>Снаряжение</h3><dl class="kv">${equipment}</dl></section>` : ''}
      ${s.notes ? `<section class="box"><h3>Заметки</h3><p style="white-space:pre-wrap">${esc(s.notes)}</p></section>` : ''}
      <p class="hint">Источник данных: TTG Club. ${eff?.source?.name ? `Класс: ${esc(eff.source.name.rus || eff.source.name.label)}.` : ''}</p>`;
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
      setStatus('Сохранено');
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
  el.official.addEventListener('change', async () => {
    state.officialOnly = el.official.checked;
    const removed = state.officialOnly ? dropUnofficialChoices() : [];
    fillMainSelects();
    await update();
    if (removed.length) setStatus(`Сброшено (неофициальные источники): ${removed.join(', ')}`);
  });

  // With the filter on, every pick must come from an official source; a hidden-but-applied
  // third-party choice would silently keep changing the sheet.
  function dropUnofficialChoices() {
    const removed = [];
    const find = (list, url) => list.find(x => x.url === url);
    const bad = item => item && !isOfficial(item);

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
      if (key === 'origin') continue; // fixed by the background
      const feat = find(featPool, entry?.url) || data.feats[entry?.url];
      if (bad(feat)) { removed.push(rus(feat)); state.feats = { ...state.feats, [key]: { url: '', option: 0, picks: [] } }; }
    }

    const keptSpells = state.spells.filter(url => !bad(find(data.spells, url)));
    if (keptSpells.length !== state.spells.length) {
      removed.push(`заклинания: ${state.spells.length - keptSpells.length}`);
      state.spells = keptSpells;
    }
    return removed;
  }
  el.cls.addEventListener('change', () => setAndUpdate({ classUrl: el.cls.value, subclassUrl: '', classSkills: [], spells: [], classEquip: 0 }));
  el.subclass.addEventListener('change', () => setAndUpdate({ subclassUrl: el.subclass.value }));
  el.species.addEventListener('change', () => setAndUpdate({ speciesUrl: el.species.value, lineageUrl: '' }));
  el.lineage.addEventListener('change', () => setAndUpdate({ lineageUrl: el.lineage.value }));
  el.background.addEventListener('change', () => {
    const feats = { ...state.feats };
    delete feats.origin;
    setAndUpdate({ backgroundUrl: el.background.value, bgPlus2: '', bgPlus1: '', bgEquip: 0, feats });
  });
  el.armor.addEventListener('change', () => setAndUpdate({ armor: el.armor.value }));
  el.shield.addEventListener('change', () => setAndUpdate({ shield: el.shield.checked }));
  el.languages.addEventListener('change', () => setAndUpdate({ languages: el.languages.value }));
  el.notes.addEventListener('change', () => setAndUpdate({ notes: el.notes.value }));
  el.spellFilter.addEventListener('input', () => update());

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
    showDetail(() => api(`spells/${url}`), sp => {
      const comps = sp.components || {};
      const compText = [comps.v && 'В', comps.s && 'С', comps.m && `М${typeof comps.m === 'string' ? ` (${comps.m})` : ''}`].filter(Boolean).join(', ');
      return `<h2>${esc(rus(sp))}</h2>
        <p class="hint">${sp.level ? `${sp.level} уровень` : 'Заговор'}, ${esc(sp.school || '')}${sp.ritual ? ' (ритуал)' : ''} · ${esc(sp.source?.name?.label || '')}</p>
        <dl class="kv">
          <dt>Время накладывания</dt><dd>${esc(sp.castingTime || '—')}</dd>
          <dt>Дистанция</dt><dd>${esc(sp.range || '—')}</dd>
          <dt>Компоненты</dt><dd>${esc(compText || '—')}</dd>
          <dt>Длительность</dt><dd>${esc(sp.duration || '—')}${sp.concentration ? ' (концентрация)' : ''}</dd>
        </dl><br>${rich(sp.description)}${sp.upper?.length ? `<h3>На более высоких уровнях</h3>${rich(sp.upper)}` : ''}`;
    });
  }
  function showFeat(url) {
    showDetail(() => api(`feats/${url}`), f => `<h2>${esc(rus(f))}</h2>
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
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
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
      state = normalizeState(JSON.parse(await file.text()));
      Object.keys(rendered).forEach(k => delete rendered[k]);
      fillMainSelects();
      syncStaticInputs();
      update();
    } catch {
      setStatus('Файл не похож на сохранённого персонажа', true);
    }
  });
  $('printBtn').addEventListener('click', () => window.print());

  // ---------- init ----------

  async function init() {
    el.armor.innerHTML = ARMORS.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('');
    syncStaticInputs();
    try {
      const [classes, species, backgrounds] = await Promise.all([
        api('classes/search'), api('species/search'), api('backgrounds/search'),
      ]);
      lists.classes = sortByName(classes);
      lists.species = sortByName(species);
      lists.backgrounds = sortByName(backgrounds);
    } catch (err) {
      console.error(err);
      setStatus('TTG Club недоступен — попробуйте позже', true);
    }
    const [skills, damage, conditions] = await Promise.all([
      api('dictionaries/skills').catch(() => null),
      api('dictionaries/damage/types').catch(() => []),
      api('dictionaries/conditions').catch(() => []),
    ]);
    if (Array.isArray(skills) && skills.length) lists.skills = [...skills].sort((a, b) => a.label.localeCompare(b.label, 'ru'));
    const toDict = arr => Object.fromEntries((Array.isArray(arr) ? arr : []).map(x => [x.value, (x.label || x.name || '').toLowerCase()]));
    lists.damage = toDict(damage);
    lists.conditions = toDict(conditions);
    fillMainSelects();
    update();
  }

  init();
})();
