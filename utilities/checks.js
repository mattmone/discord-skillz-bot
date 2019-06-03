const { posString } = require('./position.js');
const { roomSize } = require("../constants/rooms.js");
function checkForExclusions(dungeon, location, cameFrom) {
  let exclusions = new Set();

  if (Array.isArray(cameFrom)) cameFrom = posString(cameFrom);
  let checkNorth = [...location];
  checkNorth[1]--;
  checkNorth = posString(checkNorth);
  if (location[1] < -roomSize / 5) exclusions.add(0);
  if (dungeon[checkNorth])
    if (dungeon[checkNorth].exits[2] === 0) exclusions.add(0);
  let checkEast = [...location];
  checkEast[0]++;
  checkEast = posString(checkEast);
  if (location[0] > roomSize / 5) exclusions.add(1);
  if (dungeon[checkEast])
    if (dungeon[checkEast].exits[3] === 0) exclusions.add(1);
  let checkSouth = [...location];
  checkSouth[1]++;
  checkSouth = posString(checkSouth);
  if (location[1] > roomSize / 5) exclusions.add(2);
  if (dungeon[checkSouth])
    if (dungeon[checkSouth].exits[0] === 0) exclusions.add(2);
  let checkWest = [...location];
  checkWest[0]--;
  checkWest = posString(checkWest);
  if (location[0] < -roomSize / 5) exclusions.add(3);
  if (dungeon[checkWest])
    if (dungeon[checkWest].exits[1] === 0) exclusions.add(3);
  return Array.from(exclusions);
}
function checkForRequireds(dungeon, location, cameFrom) {
  let requireds = new Set();

  if (Array.isArray(cameFrom)) cameFrom = posString(cameFrom);
  let checkNorth = [...location];
  checkNorth[1]--;
  checkNorth = posString(checkNorth);
  if (checkNorth === cameFrom) requireds.add(0);
  if (dungeon[checkNorth])
    if (dungeon[checkNorth].exits[2] === 1) requireds.add(0);
  let checkEast = [...location];
  checkEast[0]++;
  checkEast = posString(checkEast);
  if (checkEast === cameFrom) requireds.add(1);
  if (dungeon[checkEast])
    if (dungeon[checkEast].exits[3] === 1) requireds.add(1);
  let checkSouth = [...location];
  checkSouth[1]++;
  checkSouth = posString(checkSouth);
  if (checkSouth === cameFrom) requireds.add(2);
  if (dungeon[checkSouth])
    if (dungeon[checkSouth].exits[0] === 1) requireds.add(2);
  let checkWest = [...location];
  checkWest[0]--;
  checkWest = posString(checkWest);
  if (checkWest === cameFrom) requireds.add(3);
  if (dungeon[checkWest])
    if (dungeon[checkWest].exits[1] === 1) requireds.add(3);
  return Array.from(requireds);
}

module.exports = {
  checkForExclusions: checkForExclusions,
  checkForRequireds: checkForRequireds
};