// Weapon table for the attacks section. Neither TTG API exposes weapon stats as data (the
// 2024 core-api only has cost/weight, the legacy API keeps properties in prose), so the
// numbers come from the SRD (5.1 / 5.2, CC-BY-4.0). Names follow TTG's Russian.
//
// cat: simple | martial; kind: melee | ranged; dmg: dice; type: damage type;
// props: finesse, light, heavy, twoHanded, reach, thrown, ammunition, loading;
// versatile: two-handed dice; range: "normal/long" ft; mastery: 2024 mastery property;
// stem: matches the weapon in 2014 proficiency lists ("длинные мечи", "ручные арбалеты").
// e2014: differences in the 2014 rules.
(() => {
  'use strict';
  const W = (key, rus, eng, cat, kind, dmg, type, props, extra = {}) => ({ key, rus, eng, cat, kind, dmg, type, props, ...extra });

  const WEAPONS = [
    // Simple melee
    W('club', 'Дубинка', 'Club', 'simple', 'melee', '1к4', 'дробящий', ['light'], { mastery: 'SLOW', stem: /дубин/ }),
    W('dagger', 'Кинжал', 'Dagger', 'simple', 'melee', '1к4', 'колющий', ['finesse', 'light', 'thrown'], { range: '20/60', mastery: 'NICK', stem: /кинжал/ }),
    W('greatclub', 'Палица', 'Greatclub', 'simple', 'melee', '1к8', 'дробящий', ['twoHanded'], { mastery: 'PUSH', stem: /палиц/ }),
    W('handaxe', 'Ручной топор', 'Handaxe', 'simple', 'melee', '1к6', 'рубящий', ['light', 'thrown'], { range: '20/60', mastery: 'VEX', stem: /ручн\S* топор/ }),
    W('javelin', 'Метательное копьё', 'Javelin', 'simple', 'melee', '1к6', 'колющий', ['thrown'], { range: '30/120', mastery: 'SLOW', stem: /метательн\S* коп/ }),
    W('light-hammer', 'Лёгкий молот', 'Light Hammer', 'simple', 'melee', '1к4', 'дробящий', ['light', 'thrown'], { range: '20/60', mastery: 'NICK', stem: /л[её]гк\S* молот/ }),
    W('mace', 'Булава', 'Mace', 'simple', 'melee', '1к6', 'дробящий', [], { mastery: 'SAP', stem: /булав/ }),
    W('quarterstaff', 'Боевой посох', 'Quarterstaff', 'simple', 'melee', '1к6', 'дробящий', [], { versatile: '1к8', mastery: 'TOPPLE', stem: /посох/ }),
    W('sickle', 'Серп', 'Sickle', 'simple', 'melee', '1к4', 'рубящий', ['light'], { mastery: 'NICK', stem: /серп/ }),
    W('spear', 'Копьё', 'Spear', 'simple', 'melee', '1к6', 'колющий', ['thrown'], { range: '20/60', versatile: '1к8', mastery: 'SAP', stem: /^коп/ }),
    // Simple ranged
    W('dart', 'Дротик', 'Dart', 'simple', 'ranged', '1к4', 'колющий', ['finesse', 'thrown'], { range: '20/60', mastery: 'VEX', stem: /дротик/ }),
    W('light-crossbow', 'Лёгкий арбалет', 'Light Crossbow', 'simple', 'ranged', '1к8', 'колющий', ['ammunition', 'loading', 'twoHanded'], { range: '80/320', mastery: 'SLOW', stem: /л[её]гк\S* арбалет/ }),
    W('shortbow', 'Короткий лук', 'Shortbow', 'simple', 'ranged', '1к6', 'колющий', ['ammunition', 'twoHanded'], { range: '80/320', mastery: 'VEX', stem: /коротк\S* лук/ }),
    W('sling', 'Праща', 'Sling', 'simple', 'ranged', '1к4', 'дробящий', ['ammunition'], { range: '30/120', mastery: 'SLOW', stem: /пращ/ }),
    // Martial melee
    W('battleaxe', 'Боевой топор', 'Battleaxe', 'martial', 'melee', '1к8', 'рубящий', [], { versatile: '1к10', mastery: 'TOPPLE', stem: /боев\S* топор/ }),
    W('flail', 'Цеп', 'Flail', 'martial', 'melee', '1к8', 'дробящий', [], { mastery: 'SAP', stem: /цеп/ }),
    W('glaive', 'Глефа', 'Glaive', 'martial', 'melee', '1к10', 'рубящий', ['heavy', 'reach', 'twoHanded'], { mastery: 'GRAZE', stem: /глеф/ }),
    W('greataxe', 'Секира', 'Greataxe', 'martial', 'melee', '1к12', 'рубящий', ['heavy', 'twoHanded'], { mastery: 'CLEAVE', stem: /секир/ }),
    W('greatsword', 'Двуручный меч', 'Greatsword', 'martial', 'melee', '2к6', 'рубящий', ['heavy', 'twoHanded'], { mastery: 'GRAZE', stem: /двуручн\S* меч/ }),
    W('halberd', 'Алебарда', 'Halberd', 'martial', 'melee', '1к10', 'рубящий', ['heavy', 'reach', 'twoHanded'], { mastery: 'CLEAVE', stem: /алебард/ }),
    W('lance', 'Длинное копьё', 'Lance', 'martial', 'melee', '1к10', 'колющий', ['heavy', 'reach', 'twoHanded'], {
      mastery: 'TOPPLE', stem: /длинн\S* коп/, e2014: { dmg: '1к12', props: ['reach'] },
    }),
    W('longsword', 'Длинный меч', 'Longsword', 'martial', 'melee', '1к8', 'рубящий', [], { versatile: '1к10', mastery: 'SAP', stem: /длинн\S* меч/ }),
    W('maul', 'Молот', 'Maul', 'martial', 'melee', '2к6', 'дробящий', ['heavy', 'twoHanded'], { mastery: 'TOPPLE', stem: /^молот/ }),
    W('morningstar', 'Моргенштерн', 'Morningstar', 'martial', 'melee', '1к8', 'колющий', [], { mastery: 'SAP', stem: /моргенштерн/ }),
    W('pike', 'Пика', 'Pike', 'martial', 'melee', '1к10', 'колющий', ['heavy', 'reach', 'twoHanded'], { mastery: 'PUSH', stem: /пик/ }),
    W('rapier', 'Рапира', 'Rapier', 'martial', 'melee', '1к8', 'колющий', ['finesse'], { mastery: 'VEX', stem: /рапир/ }),
    W('scimitar', 'Скимитар', 'Scimitar', 'martial', 'melee', '1к6', 'рубящий', ['finesse', 'light'], { mastery: 'NICK', stem: /скимитар/ }),
    W('shortsword', 'Короткий меч', 'Shortsword', 'martial', 'melee', '1к6', 'колющий', ['finesse', 'light'], { mastery: 'VEX', stem: /коротк\S* меч/ }),
    W('trident', 'Трезубец', 'Trident', 'martial', 'melee', '1к8', 'колющий', ['thrown'], {
      range: '20/60', versatile: '1к10', mastery: 'TOPPLE', stem: /трезуб/, e2014: { dmg: '1к6', versatile: '1к8' },
    }),
    W('war-pick', 'Боевая кирка', 'War Pick', 'martial', 'melee', '1к8', 'колющий', [], { versatile: '1к10', mastery: 'SAP', stem: /кирк/, e2014: { versatile: null } }),
    W('warhammer', 'Боевой молот', 'Warhammer', 'martial', 'melee', '1к8', 'дробящий', [], { versatile: '1к10', mastery: 'PUSH', stem: /боев\S* молот/ }),
    W('whip', 'Кнут', 'Whip', 'martial', 'melee', '1к4', 'рубящий', ['finesse', 'reach'], { mastery: 'SLOW', stem: /кнут/ }),
    // Martial ranged
    W('blowgun', 'Духовая трубка', 'Blowgun', 'martial', 'ranged', '1', 'колющий', ['ammunition', 'loading'], { range: '25/100', mastery: 'VEX', stem: /духов\S* трубк/ }),
    W('hand-crossbow', 'Ручной арбалет', 'Hand Crossbow', 'martial', 'ranged', '1к6', 'колющий', ['ammunition', 'light', 'loading'], { range: '30/120', mastery: 'VEX', stem: /ручн\S* арбалет/ }),
    W('heavy-crossbow', 'Тяжёлый арбалет', 'Heavy Crossbow', 'martial', 'ranged', '1к10', 'колющий', ['ammunition', 'heavy', 'loading', 'twoHanded'], { range: '100/400', mastery: 'PUSH', stem: /т[яе]ж[её]л\S* арбалет/ }),
    W('longbow', 'Длинный лук', 'Longbow', 'martial', 'ranged', '1к8', 'колющий', ['ammunition', 'heavy', 'twoHanded'], { range: '150/600', mastery: 'SLOW', stem: /длинн\S* лук/ }),
  ];

  const PROPERTY_NAMES = {
    finesse: 'фехтовальное', light: 'лёгкое', heavy: 'тяжёлое', twoHanded: 'двуручное', reach: 'досягаемость',
    thrown: 'метательное', ammunition: 'боеприпасы', loading: 'перезарядка',
  };
  const MASTERY_NAMES = {
    CLEAVE: 'Прорубание', GRAZE: 'Задевание', NICK: 'Надрез', PUSH: 'Толчок',
    SAP: 'Ослабление', SLOW: 'Замедление', TOPPLE: 'Опрокидывание', VEX: 'Раздражение',
  };

  // The weapon as it is in a given edition.
  function forEdition(weapon, edition) {
    if (edition !== '2014' || !weapon.e2014) return weapon;
    return { ...weapon, ...weapon.e2014, props: weapon.e2014.props || weapon.props };
  }

  window.DND_WEAPONS = { WEAPONS, PROPERTY_NAMES, MASTERY_NAMES, forEdition };
})();
