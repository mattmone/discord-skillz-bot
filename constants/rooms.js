
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
  "dungeon"
];

const size = 20;
module.exports = {
  roomTemplates: templates,
  roomTypes: types,
  roomSize: size
};