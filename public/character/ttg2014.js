// Adapter for the legacy TTG Club API (D&D 2014 rules, 5e14.ttg.club/api/v1).
// Converts its payloads into the shapes the character builder already uses for the
// 2024 core-api, so one rules engine can serve both editions.
(() => {
  'use strict';

  const ABILITY_KEYS = ['STRENGTH', 'DEXTERITY', 'CONSTITUTION', 'INTELLIGENCE', 'WISDOM', 'CHARISMA'];
  const ABILITY_BY_RUS = {
    'сила': 'STRENGTH', 'ловкость': 'DEXTERITY', 'телосложение': 'CONSTITUTION',
    'интеллект': 'INTELLIGENCE', 'мудрость': 'WISDOM', 'харизма': 'CHARISMA',
  };

  // 2014 PHB skill names as TTG prints them ("Магия" is Arcana in the 2014 translation).
  const SKILLS = [
    ['Акробатика', 'ACROBATICS', 'DEXTERITY'], ['Анализ', 'INVESTIGATION', 'INTELLIGENCE'],
    ['Атлетика', 'ATHLETICS', 'STRENGTH'], ['Внимательность', 'PERCEPTION', 'WISDOM'],
    ['Выживание', 'SURVIVAL', 'WISDOM'], ['Выступление', 'PERFORMANCE', 'CHARISMA'],
    ['Запугивание', 'INTIMIDATION', 'CHARISMA'], ['История', 'HISTORY', 'INTELLIGENCE'],
    ['Ловкость рук', 'SLEIGHT_OF_HAND', 'DEXTERITY'], ['Магия', 'ARCANA', 'INTELLIGENCE'],
    ['Медицина', 'MEDICINE', 'WISDOM'], ['Обман', 'DECEPTION', 'CHARISMA'],
    ['Природа', 'NATURE', 'INTELLIGENCE'], ['Проницательность', 'INSIGHT', 'WISDOM'],
    ['Религия', 'RELIGION', 'INTELLIGENCE'], ['Скрытность', 'STEALTH', 'DEXTERITY'],
    ['Убеждение', 'PERSUASION', 'CHARISMA'], ['Уход за животными', 'ANIMAL_HANDLING', 'WISDOM'],
  ].map(([label, value, ability]) => ({ label, value, ability }));
  const SKILL_BY_LABEL = Object.fromEntries(SKILLS.map(s => [s.label.toLowerCase(), s.value]));

  // Rules the legacy API only states in prose. Keyed by "<section>/<slug>".
  const KNOWN_MECHANICS = {
    'races/dwarf/hil': { modifiers: { hitPoints: { perAcquisitionLevel: 1, perLevelAfterAcquisition: 1 } } },
    'traits/tough': { modifiers: { hitPoints: { perAcquisitionLevel: 2, perLevelAfterAcquisition: 2 } } },
    'traits/alert': { modifiers: { initiativeBonus: 5 } },
    'traits/observant': { modifiers: { passivePerceptionBonus: 5 } },
    'classes/sorcerer/draconic': { modifiers: { hitPoints: { perAcquisitionLevel: 1, perLevelAfterAcquisition: 1 } } },
  };

  // The legacy data says level 2 for these, but the 2014 PHB has Sorcerous Origin and
  // Otherworldly Patron at level 1. Every other PHB class matches the book.
  const SUBCLASS_LEVEL_FIX = { sorcerer: 1, warlock: 1 };

  // Subclasses that add spellcasting to a non-casting class. Both use the wizard list.
  const SUBCLASS_CASTERS = {
    'fighter/eldritch_knight': { ability: 'INTELLIGENCE', listClassId: 2 },
    'rogue/arcane_trickster': { ability: 'INTELLIGENCE', listClassId: 2 },
  };

  const CASTER_TYPES = { FULL: 'FULL', HALF: 'HALF', PARTLY: 'PACT', NONE: 'NONE' };

  // "/classes/fighter/eldritch_knight" -> "fighter/eldritch_knight"
  const slug = url => String(url || '').replace(/^\/(classes|races|backgrounds|traits|feats|spells)\//, '');

  const source = src => ({
    name: { label: src?.shortName || '', rus: src?.name || src?.shortName || '' },
    group: { label: src?.group?.shortName || '', rus: src?.group?.name || '' },
  });

  const name = n => ({ rus: n?.rus || n?.eng || '', eng: n?.eng || '' });

  const toNumber = v => {
    if (v == null) return null;
    const n = Number(String(v).replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) && String(v).trim() !== '—' ? n : null;
  };

  function abilitiesFromText(text) {
    return String(text || '').split(/[,;]|\sи\s/).map(x => ABILITY_BY_RUS[x.trim().toLowerCase()]).filter(Boolean);
  }

  function armorCategories(lines) {
    const text = (lines || []).join(' ').toLowerCase();
    const cats = [];
    if (/л[её]гк/.test(text)) cats.push('LIGHT');
    if (/средн/.test(text)) cats.push('MEDIUM');
    if (/т[яе]ж[её]л/.test(text)) cats.push('HEAVY');
    if (/щит/.test(text)) cats.push('SHIELD');
    return cats;
  }

  const joinLines = lines => (lines || []).filter(x => x && !/^нет$/i.test(String(x).trim())).join('; ');

  // Class table columns live in traits.levels as parallel value arrays.
  function tableFromLevels(traits) {
    const levels = traits?.levels || [];
    const build = (defs, field) => (defs || []).map((def, j) => ({
      name: def.name,
      values: levels.map(l => (l[field] || [])[j]),
    }));
    const columns = [...build(traits?.classFeatureLevels, 'classFeatureValues'), ...build(traits?.archetypeFeatureLevels, 'archetypeFeatureValues')];
    return columns.map((col, i) => {
      const n = col.name.toLowerCase();
      const purpose = /заговор/.test(n) ? 'CANTRIPS_KNOWN'
        : /известные заклинания/.test(n) ? 'SPELLS_KNOWN'
          : /^ячейки заклинаний/.test(n) ? 'PACT_SLOTS'
            : /уровень ячеек/.test(n) ? 'PACT_LEVEL'
              : 'NONE';
      return {
        name: col.name, key: `col${i}`, purpose,
        scaling: col.values.map((value, idx) => ({ level: idx + 1, value: value === '-1' ? '∞' : value })),
      };
    });
  }

  function slotTableFromLevels(traits) {
    const rows = (traits?.levels || []).map(l => (l.spellSlots || []).map(toNumber).filter(n => n != null && n > 0));
    return rows.some(r => r.length) ? rows : null;
  }

  function normalizeFeature(f, parentKey) {
    const isAsi = /^увеличение характеристик$/i.test((f.name || '').trim());
    return {
      key: `${parentKey}-${f.id || f.name}`,
      name: f.name,
      level: f.level || 1,
      description: f.description || [],
      scaling: (f.scaling || []).map(s => ({ ...s, name: s.name || f.name })),
      abilityImprovement: isAsi,
      isSubclass: Boolean(f.archetypeFeature),
      optional: Boolean(f.optional),
      mechanics: f.mechanics && Object.keys(f.mechanics).length ? f.mechanics : null,
    };
  }

  // detail: legacy class (or archetype) detail. parent: the base class detail for archetypes.
  // requestSlug: the slug the detail was fetched by ("wizard" or "fighter/eldritch_knight");
  // archetype payloads repeat the parent's url, so it cannot be read from the detail.
  function normalizeClass(detail, parent, requestSlug) {
    const base = parent || detail;
    const traits = detail.traits || {};
    const baseTraits = base.traits || {};
    const url = requestSlug || slug(detail.url);

    const choice = (base.mechanics?.choices || []).find(c => c.type === 'SKILL');
    const skillData = choice
      ? { count: choice.count, skills: choice.options.map(o => o.value) }
      : { count: baseTraits.skillAvailableCount || 0, skills: (baseTraits.availableSkills || []).map(l => SKILL_BY_LABEL[l.toLowerCase()]).filter(Boolean) };

    let casterType = CASTER_TYPES[base.spellcasterType] || 'NONE';
    let spellcastingAbility = base.spellAbility || null;
    const slotTable = slotTableFromLevels(traits);
    let spellListClassId = base.id;
    const subCaster = parent ? SUBCLASS_CASTERS[url] : null;
    if (casterType === 'NONE' && (subCaster || (parent && slotTable))) {
      casterType = 'THIRD';
      spellcastingAbility = subCaster?.ability || 'INTELLIGENCE';
      spellListClassId = subCaster?.listClassId || 2;
    }
    const table = tableFromLevels(traits);
    const firstSlotLevel = slotTable ? slotTable.findIndex(r => r.length) + 1 : 0;
    const pactCol = table.find(c => c.purpose === 'PACT_SLOTS');
    const spellcastingStartLevel = casterType === 'PACT'
      ? (pactCol ? pactCol.scaling.findIndex(s => toNumber(s.value) > 0) + 1 : 1)
      : firstSlotLevel || 1;

    const features = (traits.features || []).map(f => normalizeFeature(f, url));
    const diceHp = baseTraits.diceHp || toNumber(base.dice) || 8;
    const mechanics = { ...(KNOWN_MECHANICS[`classes/${url}`] || {}) };

    return {
      edition: '2014',
      id: base.id,
      url,
      name: name(parent && traits.archetype?.name ? { rus: traits.archetype.name } : detail.name),
      source: source(detail.source),
      hitDice: { label: `к${diceHp}`, value: `d${diceHp}`, maxValue: diceHp, avg: diceHp / 2 + 1 },
      savingThrowAbilities: base.mechanics?.proficiencies?.savingThrows || abilitiesFromText(baseTraits.savingThrows),
      proficiency: {
        armor: joinLines(baseTraits.armor),
        weapon: joinLines(baseTraits.weapon),
        tool: joinLines(baseTraits.tools),
        skillData,
        armorData: { category: armorCategories(baseTraits.armor) },
      },
      casterType,
      spellcastingAbility,
      spellcastingStartLevel,
      spellListClassId,
      // Prepared casters (cleric, druid, wizard, paladin, artificer) have no "known spells" column.
      preparedHalfLevel: casterType === 'HALF',
      subclassLevel: SUBCLASS_LEVEL_FIX[slug(base.url)] || base.enabledArhitypeLevel || 3,
      subclassLabel: base.archetypeName || 'Архетип',
      hasSubclasses: (base.archetypes || []).length > 0,
      features,
      table,
      slotTable,
      equipmentMarkup: baseTraits.equipment || [],
      mechanics: Object.keys(mechanics).length ? mechanics : null,
      parent: parent ? { url: slug(parent.url) } : null,
    };
  }

  function normalizeSubclassShort(a) {
    return { url: slug(a.url), name: name(a.name), source: source(a.source) };
  }

  function normalizeClassShort(c) {
    return {
      url: slug(c.url), name: name(c.name), source: source(c.source),
      hasSubclasses: (c.archetypes || []).length > 0,
      archetypes: (c.archetypes || []).map(normalizeSubclassShort),
    };
  }

  // ---------- races ----------

  function normalizeRaceShort(r) {
    return {
      url: slug(r.url), name: name(r.name), source: source(r.source),
      hasLineages: (r.subraces || []).length > 0,
      subraces: (r.subraces || []).map(s => ({ url: slug(s.url), name: name(s.name), source: source(s.source) })),
    };
  }

  const CHOICE_KEYS = new Set(['ONE', 'CHOICE', 'CHOICE_UNIQUE', 'CHOICE_DOUBLE', 'TWO', 'ANY']);

  // Race ability bonuses are cumulative entries. Some entries understate how many free
  // picks the race gets (variant human: +1 to two), so reconcile with the "abilities" list.
  function raceAbilityBonuses(detail) {
    const entries = (detail.mechanics?.abilityBonuses || []).map(e => ({ ...e }));
    const freeChoices = (detail.abilities || []).filter(a => CHOICE_KEYS.has(a.key) || !ABILITY_KEYS.includes(a.key));
    const freeEntry = entries.find(e => (e.abilities || []).length > (e.count || 1));
    if (freeEntry && freeChoices.length > (freeEntry.count || 1)) freeEntry.count = freeChoices.length;
    if (!entries.length) {
      for (const a of detail.abilities || []) {
        if (ABILITY_KEYS.includes(a.key)) entries.push({ abilities: [a.key], bonus: a.value });
      }
    }
    return entries;
  }

  function movementFrom(speed) {
    const movement = {};
    for (const s of speed || []) {
      const n = (s.name || '').toLowerCase();
      if (!n) movement.base = s.value;
      else if (/лета|полёт|полет/.test(n)) movement.fly = s.value;
      else if (/плава/.test(n)) movement.swim = s.value;
      else if (/лаза/.test(n)) movement.climb = s.value;
      else if (/копа/.test(n)) movement.burrow = s.value;
    }
    return movement;
  }

  // isSubrace: subrace detail lists only its own features and its full ability bonus set.
  function normalizeRace(detail, requestSlug) {
    const props = {};
    const movement = movementFrom(detail.speed);
    if (movement.base) props.movement = movement;
    if (detail.size) props.size = detail.size;
    if (detail.darkvision) props.darkVision = detail.darkvision;
    if (typeof detail.type === 'string') props.type = detail.type;
    else if (detail.type?.name && !/базов/i.test(detail.type.name)) props.type = detail.type.name;

    const extra = KNOWN_MECHANICS[`races/${requestSlug}`];
    const raceMechanics = { ...(detail.mechanics || {}) };
    delete raceMechanics.abilityBonuses; // applied separately, with the player's picks
    if (extra?.modifiers) raceMechanics.modifiers = { ...(raceMechanics.modifiers || {}), ...extra.modifiers };

    // Traits that only restate numbers the sheet already shows (bonuses, size, speed) or pure flavour.
    const SHOWN_ELSEWHERE = /^(увеличение характеристик|возраст|мировоззрение|размер|скорость)$/i;
    const features = (detail.features || []).filter(f => !SHOWN_ELSEWHERE.test((f.name || '').trim())).map(f => ({
      name: { rus: f.name },
      description: f.description || [],
      mechanics: f.mechanics && Object.keys(f.mechanics).length ? f.mechanics : null,
    }));
    return {
      edition: '2014',
      url: requestSlug,
      name: name(detail.name),
      source: source(detail.source),
      properties: props,
      features,
      mechanics: raceMechanics,
      abilityBonuses: raceAbilityBonuses(detail),
      grantsFeat: features.some(f => /^черта$/i.test(f.name.rus.trim())),
    };
  }

  // ---------- backgrounds, feats, spells ----------

  function normalizeBackgroundShort(b) {
    return { url: slug(b.url), name: name(b.name), source: source(b.source) };
  }

  function normalizeBackground(detail) {
    const skillValues = detail.mechanics?.proficiencies?.skills
      || (detail.skills || []).map(l => SKILL_BY_LABEL[String(l).toLowerCase()]).filter(Boolean);
    return {
      edition: '2014',
      url: slug(detail.url),
      name: name(detail.name),
      source: source(detail.source),
      skillProficiencies: (detail.skills || []).join(', '),
      skillValues,
      toolMarkup: detail.toolOwnership || [],
      language: detail.language || '',
      equipmentMarkup: detail.equipments || [],
      startGold: detail.startGold || 0,
      featureName: detail.skillName || '',
      featureDescription: detail.skillDescription || [],
    };
  }

  function normalizeFeatShort(t) {
    return { url: slug(t.url), name: name(t.name), source: source(t.source), requirements: t.requirements };
  }

  function normalizeFeat(detail, requestSlug) {
    const extra = KNOWN_MECHANICS[`traits/${requestSlug}`];
    const mechanics = { ...(detail.mechanics || {}) };
    if (!mechanics.abilityBonuses && (detail.abilities || []).length) {
      mechanics.abilityBonuses = [{ abilities: detail.abilities, bonus: 1, upto: 20, count: 1 }];
    }
    if (extra?.modifiers) mechanics.modifiers = { ...(mechanics.modifiers || {}), ...extra.modifiers };
    const req = String(detail.requirements || '').trim();
    return {
      edition: '2014',
      url: requestSlug,
      name: name(detail.name),
      source: source(detail.source),
      category: 'Черта',
      prerequisite: req && !/^нет$/i.test(req) ? req : '',
      description: detail.description || [],
      mechanics,
    };
  }

  const capital = s => (s ? s[0].toUpperCase() + s.slice(1) : '');

  function normalizeSpellShort(s) {
    return {
      url: slug(s.url), name: name(s.name), source: source(s.source),
      level: s.level || 0, school: capital(s.school || ''), components: s.components || {},
      concentration: Boolean(s.concentration), ritual: Boolean(s.ritual),
    };
  }

  function normalizeSpell(detail) {
    const duration = detail.duration || '';
    return {
      ...normalizeSpellShort(detail),
      castingTime: detail.time || '',
      range: detail.range || '',
      duration,
      concentration: /концентрац/i.test(duration) || Boolean(detail.concentration),
      ritual: Boolean(detail.ritual),
      description: detail.description || [],
      upper: detail.upper ? [].concat(detail.upper) : [],
    };
  }

  window.TTG2014 = {
    SKILLS,
    slug,
    normalizeClass, normalizeClassShort,
    normalizeRace, normalizeRaceShort,
    normalizeBackground, normalizeBackgroundShort,
    normalizeFeat, normalizeFeatShort,
    normalizeSpell, normalizeSpellShort,
  };
})();
