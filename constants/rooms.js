
const templates = [
  [1,1,1,1],
  [0,1,1,1],
  [1,0,1,1],
  [1,1,0,1],
  [1,1,1,0],
  [0,0,1,1],
  [0,1,0,1],
  [0,1,1,0],
  [1,0,0,1],
  [1,1,0,0],
  [1,0,1,0],
  [1,0,0,0],
  [0,1,0,0],
  [0,0,1,0],
  [0,0,0,1]
];

const types = [
  "dungeon",
  "entrance",
  "exit"
];

const size = 20;
module.export = {
  roomTemplates: templates,
  roomTypes: types,
  roomSize: size
};