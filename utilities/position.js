function posNumbers(position) {
  console.log(position);
  let pos = position.split(",");
  pos[0] = parseInt(pos[0], 10);
  pos[1] = parseInt(pos[1], 10);
  return pos;
}
function posString(position) {
  if (!position.join) return position;
  return position.join(",");
}
module.exports = {
  posNumbers: posNumbers,
  posString: posString
}