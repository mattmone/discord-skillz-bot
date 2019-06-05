const melee = [
  {"type": "dagger", "level": 1, "modifier": 4, "cost": 400},
  {"type": "short sword", "level": 1, "modifier": 6, "cost": 700},
  {"type": "long sword", "level": 1, "modifier": 8, "cost": 1000},
  {"type": "broadsword", "level": 1, "modifier": 10, "cost": 1500},
  {"type": "claymore", "level": 1, "modifier": 12, "cost": 2000},
  {"type": "masterwork sword", "level": 1, "modifier": 20, "cost": 4000}
];
const range = [
  {"type": "sling", "level": 1, "modifier": 4, "cost": 400},
  {"type": "throwing knife", "level": 1, "modifier": 6, "cost": 700},
  {"type": "short bow", "level": 1, "modifier": 8, "cost": 1000},
  {"type": "longbow", "level": 1, "modifier": 10, "cost": 1500},
  {"type": "crossbow", "level": 1, "modifier": 12, "cost": 2000},
  {"type": "arbalest", "level": 1, "modifier": 20, "cost": 4000}
];
const spells = [
  {"type": "magic missle", "level": 1, "modifier": 4, "cost": 400},
  {"type": "burning hands", "level": 1, "modifier": 6, "cost": 700},
  {"type": "spark", "level": 1, "modifier": 8, "cost": 1000},
  {"type": "fireball", "level": 1, "modifier": 10, "cost": 1500},
  {"type": "ball lightning", "level": 1, "modifier": 12, "cost": 2000},
  {"type": "disintigrate", "level": 1, "modifier": 20, "cost": 4000}
];

module.exports = {
  melee: melee,
  range: range,
  spells: spells
};