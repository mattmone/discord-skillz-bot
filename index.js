const Discord = require("discord.io");
const logger = require("winston");
const auth = require("./auth.json");
const fs = require('fs');
const { createCanvas } = require('canvas')
// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console(), {
  colorize: true
});
logger.level = "debug";
// Initialize Discord Bot
const bot = new Discord.Client({
  token: auth.token,
  autorun: true
});
let servers = {};
bot.on("ready", function(event) {
  logger.info("Connected");
  logger.info("Logged in as: ");
  logger.info(bot.username + " - (" + bot.id + ")");
  if(fs.existsSync('./data/servers.json'))
    servers = JSON.parse(fs.readFileSync('./data/servers.json'));
  for(server in bot.servers) {
    if(!servers[server]) servers[server] = {};
    let members = Object.assign({}, bot.servers[server].members);
    if(!servers[server].members) servers[server].members = members;
    for(let member of Object.values(members)) {
      if(Object.keys(servers[server].members).filter(m => member.id === m).length === 0) {
        servers[server].members[member.id] = Object.assign({}, member);
      }
    }
  }
});
bot.on("message", function(user, userID, channelID, message, event) {
  //listen for bot mention
  if(userID === bot.id) return;
  let commandMatch;
  if(channelID == 580758335519850506)
    commandMatch = /(new skill|check skill|level up|server skills|skill tree|dungeon map|enter dungeon|(?:dungeon )?move|exit dungeon|leave dungeon|show loot) ?(.+)?/gi.exec(message);
  else {
    if (message.indexOf(`<@${bot.id}>`) === -1 && message.indexOf(`<@!${bot.id}>`) === -1) return;
    commandMatch = /(new skill|check skill|level up|server skills|skill tree|random dungeon|go) ?(.+)?/gi.exec(message);
  }
  if(commandMatch === null) return;
  commandMatch.shift();
  let [command, args] = commandMatch;
  command = command.toLowerCase();
  console.log(command, args);
  if(!commands[command]) return bot.sendMessage({to: channelID, message: `sorry, I don't understand.`});
  commands[command](event.d.guild_id, channelID, args, userID);
  setTimeout(_ => {
    fs.writeFile('./data/servers.json', JSON.stringify(servers), _ => {
      console.log('wrote to servers.json');
    });
  }, 1500);
}); 

const commands = {
  "new skill": newSkill,
  "check skill": checkSkill,
  "level up": levelUp,
  "server skills": serverSkills,
  "skill tree": skillTree,
  "dungeon map": dungeonMap,
  "enter dungeon": enterDungeon,
  "dungeon move": moveInDungeon,
  "move": moveInDungeon,
  "exit dungeon": exitDungeon,
  "leave dungeon": exitDungeon,
  "show loot": showLoot,
  "random dungeon": randomDungeon,
  "go": goToDungeonRoom
};
const roomTemplates = [
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
const roomTypes = [
  "dungeon",
  "dungeon",
  "dungeon",
  "dungeon",
  "dungeon",
  "dungeon",
  "dungeon",
  "dungeon",
  "dungeon",
  "dungeon",
  "dungeon",
  "dungeon",
  "dungeon",
  "dungeon",
  "dungeon",
  "dungeon",
  "entrance",
  "exit"
];
const monsters = [
  "data goblin",
  "dragon duck",
  "small boi"
];
let lastGenerated;
const roomSize = 20;
function showLoot(server, channelID, args, member) {
  if(!servers[server].members[member].loot) servers[server].members[member].loot = {gold: 0, gems: 0, ores: 0};
  let loot = servers[server].members[member].loot;
  let message = `<@${member}>'s current loot:
  ${loot.gold} gold
  ${loot.gems} gems
  ${loot.ores} ores`;
  bot.sendMessage({to: channelID, message: message});
}

function drawRando(server, channelID) {
  const state = servers[server].dState;
  const { dungeon, userLocation} = state;
  const canvasSize = roomSize*15;
  const canvas = createCanvas(canvasSize, canvasSize)
  const ctx = canvas.getContext('2d')
  const openingSize = 1/4;
  ctx.lineWidth = 2;
  ctx.translate(canvasSize/2,canvasSize/2);
  let dungeonArr = [];
  for(let room in dungeon) {
    dungeon[room].location = room;
    dungeonArr.push(dungeon[room]);
  }
  dungeonArr.sort((a,b) => a.type > b.type ? 1 : -1);
  for(let room of dungeonArr) {
    let roomCoords = room.location;
    const [x, y] = roomCoords.split(',').map(coord => parseInt(coord)*roomSize);
    const [top, right, bottom, left] = [y-roomSize/2, x+roomSize/2, y+roomSize/2, x-roomSize/2];
    // const room = dungeon[roomCoords];
    ctx.strokeStyle = "#FFF";
    if(room.type === 'entrance') ctx.strokeStyle = "#FFD700";
    if(room.type === 'exit') ctx.strokeStyle = "#F00";
    
    ctx.beginPath();
    ctx.moveTo(left, top);
    if(room.exits[0] === 1) {
      ctx.lineTo(left + roomSize*openingSize, top);
      ctx.moveTo(left + roomSize*(1-openingSize), top);
    }
    ctx.lineTo(right, top);
    if(room.exits[1] === 1) {
      ctx.lineTo(right, top + roomSize*openingSize);
      ctx.moveTo(right, top + roomSize*(1-openingSize));
    }
    ctx.lineTo(right, bottom);
    if(room.exits[2] === 1) {
      ctx.lineTo(left + roomSize*(1-openingSize), bottom);
      ctx.moveTo(left + roomSize*openingSize, bottom);
    }
    ctx.lineTo(left, bottom);
    if(room.exits[3] === 1) {
      ctx.lineTo(left, top + roomSize*(1-openingSize));
      ctx.moveTo(left, top + roomSize*openingSize);
    }
    ctx.lineTo(left, top);
    ctx.stroke();
    if(roomCoords === userLocation) {
      ctx.fillStyle = "#0F0";
      ctx.fillRect(left+roomSize*openingSize, top+roomSize*openingSize, roomSize-(roomSize*openingSize*2), roomSize-(roomSize*openingSize*2));
    }
  }
  
  const out = fs.createWriteStream(__dirname + '/dungeon.png');
  const stream = canvas.createPNGStream();
  stream.pipe(out);
  out.on('finish', _ => {
    return bot.uploadFile({to: channelID, message: `Dungeon Level ${state.level}`, file: __dirname + '/dungeon.png'});
  })
}
function randomDungeon(server, channelID, args, member) {
  servers[server].dState = {};
  servers[server].dState.dungeon = {};
  let dungeon = servers[server].dState.dungeon;
  servers[server].dState.userLocation = "0,0";
  servers[server].dState.level = 1;
  dungeon["0,0"] = {
    exits: generateMapRoom({minimumExits:3}),
    type: 'entrance'
  };
  drawRando(server, channelID);
}
function posNumbers(position) {
  let pos = position.split(',');
  pos[0] = parseInt(pos[0],10);
  pos[1] = parseInt(pos[1],10);
  return pos;
}
function posString(position) {
  if(!position.join) return position;
  return position.join(",");
}
function checkForExclusions(dungeon, location, cameFrom) {
  let exclusions = new Set();
  
  if(Array.isArray(cameFrom)) cameFrom = posString(cameFrom);
  let checkNorth = [...location];
  checkNorth[1]--;
  checkNorth = posString(checkNorth);
  if(location[1] < -roomSize / 5) exclusions.add(0);
  if(dungeon[checkNorth] && checkNorth !== cameFrom) exclusions.add(0);
  let checkEast = [...location];
  checkEast[0]++;
  checkEast = posString(checkNorth);
  if(dungeon[checkEast] && checkEast !== cameFrom && location[0] > roomSize/5) exclusions.add(1);
  let checkSouth = [...location];
  checkSouth[1]++;
  checkSouth = posString(checkSouth);
  if(location[1] > roomSize / 5) exclusions.add(2);
  if(dungeon[checkSouth] && checkSouth !== cameFrom) exclusions.add(2);
  let checkWest = [...location];
  checkWest[0]--;
  checkWest = posString(checkWest);
  if(dungeon[checkWest] && checkWest !== cameFrom && location[0] < roomSize/5) exclusions.add(3);
  return Array.from(exclusions);
}
function checkForRequireds(dungeon, location, cameFrom) {
  let requireds = new Set();
  
  if(Array.isArray(cameFrom)) cameFrom = posString(cameFrom);
  let checkNorth = [...location];
  checkNorth[1]--;
  checkNorth = posString(checkNorth);
  if(checkNorth === cameFrom) requireds.add(0);
  if(dungeon[checkNorth])
    if(dungeon[checkNorth][2] === 1)
      requireds.add(0);
  let checkEast = [...location];
  checkEast[0]++;
  checkEast = posString(checkEast);
  if(checkEast === cameFrom) requireds.add(1);
  if(dungeon[checkEast]) 
    if(dungeon[checkEast][3] === 1)
      requireds.add(1);
  let checkSouth = [...location];
  checkSouth[1]++;
  checkSouth = posString(checkSouth);
  if(checkSouth === cameFrom) requireds.add(2);
  if(dungeon[checkSouth]) 
    if(dungeon[checkSouth][0] === 1)
      requireds.add(2);
  let checkWest = [...location];
  checkWest[0]--;
  checkWest = posString(checkWest);
  if(checkWest === cameFrom) requireds.add(3);
  if(dungeon[checkWest]) 
    if(dungeon[checkWest][1] === 1)
      requireds.add(3);
  return Array.from(requireds);
}
function goToDungeonRoom(server, channelID, args, member) {
  const state = servers[server].dState;
  const uLoc = posNumbers(state.userLocation);
  let userLocation;
  let generationOptions;
  const dungeon = state.dungeon;
  args = args.split(" ");
  const direction = args.shift();
  switch(direction) {
    case "n":
    case "north":
    case "up":
      if(dungeon[state.userLocation].exits[0] === 0) return badDirection(channelID, member);
      uLoc[1]--;
      userLocation = posString(uLoc);
      generationOptions = {
        minimumExits: 1,
        requiredExits: checkForRequireds(dungeon, uLoc, state.userLocation),
        excludedExits: checkForExclusions(dungeon, uLoc, state.userLocation)
      }
      break;
    case "e":
    case "east":
    case "right":
      if(dungeon[state.userLocation].exits[1] === 0) return badDirection(channelID, member);
      uLoc[0]++;
      userLocation = posString(uLoc);
      generationOptions = {
        minimumExits: 1,
        requiredExits: checkForRequireds(dungeon, uLoc, state.userLocation),
        excludedExits: checkForExclusions(dungeon, uLoc, state.userLocation)
      }
      break;
    case "s":
    case "south":
    case "down":
      if(dungeon[state.userLocation].exits[2] === 0) return badDirection(channelID, member);
      uLoc[1]++;
      userLocation = posString(uLoc);
      generationOptions = {
        minimumExits: 1,
        requiredExits: checkForRequireds(dungeon, uLoc, state.userLocation),
        excludedExits: checkForExclusions(dungeon, uLoc, state.userLocation)
      }
      break;
    case "w":
    case "west":
    case "left":
      if(dungeon[state.userLocation].exits[3] === 0) return badDirection(channelID, member);
      uLoc[0]--;
      userLocation = posString(uLoc);
      generationOptions = {
        minimumExits: 1,
        requiredExits: checkForRequireds(dungeon, uLoc, state.userLocation),
        excludedExits: checkForExclusions(dungeon, uLoc, state.userLocation)
      }
      break;
    default:
      return badDirection(channelID, member);
      break;
  }
  if(!dungeon[userLocation]) 
    dungeon[userLocation] = { 
      exits: generateMapRoom(generationOptions),
      type: roomTypes[Math.floor(Math.random()*roomTypes.length)]
    };
  state.userLocation = userLocation;
  drawRando(server, channelID);
}
function generateMapRoom(options) {
  let {minimumExits, requiredExits, maximumExits, excludedExits} = options;
  if(requiredExits)
    for(required of requiredExits) excludedExits = excludedExits.filter(exclude => exclude !== required);
  let filteredRooms = roomTemplates.filter(exits => exits.reduce((total, num) => total + num) >= minimumExits);
  if(excludedExits) 
    for(exclude of excludedExits)
      filteredRooms = filteredRooms.filter(exits => exits[exclude] === 0)
  if(maximumExits >= 0) filteredRooms = filteredRooms.filter(exits => exits.reduce((total, num) => total + num) <= minimumExits);
  if(requiredExits) 
    for(required of requiredExits)
      filteredRooms = filteredRooms.filter(exits => exits[required] === 1)
  return filteredRooms[Math.floor(Math.random()*filteredRooms.length)];
}
function generateDungeon() {
  const boardSize = 10;
  let board = "0".repeat(boardSize).split("").map(row => "0".repeat(boardSize).split("").map(column => {return {};}));
  board[0][0] = {type: 'entrance', fightChance: .25, lootChance: .25, gemChance: 0, oreChance: 0, location: [0,0]};
  lastGenerated = Object.assign({}, board[0][0]);
  board[0][1] = Math.random() >= 0.25 ? generateRoom(1, [0,1]) : false;
  board[1][0] = !board[0][1] ? generateRoom(1, [1,0]) : (Math.random() > 0.5 ? generateRoom(1, [1,0]) : false);
  for(let rowIndex = 0; rowIndex < board.length; rowIndex++) {
    let level = Math.ceil((rowIndex + 1) / 2);
    for(let columnIndex = 0; columnIndex < board[rowIndex].length; columnIndex++) {
      let connectorGenerated = false;
      if(rowIndex !== 0)
        if(board[rowIndex-1][columnIndex] !== false && !board[rowIndex-1][columnIndex].type)
          if(Math.random() <= 0.25) {
            board[rowIndex-1][columnIndex] = generateRoom(level, [rowIndex-1,columnIndex]);
            connectorGenerated = true;
          } else board[rowIndex-1][columnIndex] = false;
      if(columnIndex !== 0)
        if(board[rowIndex][columnIndex-1] !== false && !board[rowIndex][columnIndex-1].type)
          if(Math.random() <= 0.25) {
            board[rowIndex][columnIndex-1] = generateRoom(level, [rowIndex,columnIndex-1]);
            connectorGenerated = true;
          } else board[rowIndex][columnIndex-1] = false;
      if(rowIndex+1 !== board.length)
        if(board[rowIndex+1][columnIndex] !== false && !board[rowIndex+1][columnIndex].type)
          if(Math.random() <= 0.5) {
            board[rowIndex+1][columnIndex] = generateRoom(level, [rowIndex+1,columnIndex]);
            connectorGenerated = true;
          } else board[rowIndex+1][columnIndex] = false;
      if(columnIndex+1 !== board[rowIndex].length)
        if(board[rowIndex][columnIndex+1] !== false && !board[rowIndex][columnIndex+1].type)
          if(Math.random() <= 0.75 || !connectorGenerated) {
            board[rowIndex][columnIndex+1] = generateRoom(level, [rowIndex, columnIndex+1]);
          } else board[rowIndex][columnIndex+1] = false;
    }
  }
  for(let rowIndex = 0; rowIndex < board.length; rowIndex++) {
    for(let columnIndex = 0; columnIndex < board[rowIndex].length; columnIndex++) {
      if(board[rowIndex][columnIndex] === false || board[rowIndex][columnIndex].type) continue;
      board[rowIndex][columnIndex] = false;
    }
  }
  return board;
}
function drawDungeon(server, channelID, userLocation, premessage) {
  let board = servers[server].board;
  let message = premessage ? (premessage + "\n") : '';
  if(userLocation) message += `You are in a ${board[userLocation[0]][userLocation[1]].type} room, level ${board[userLocation[0]][userLocation[1]].level}.`;
  else message += "Today's dungeon map:";
  message += "\n```\n";
  for(let rowIndex in board) {
    board[rowIndex].forEach(_ => message += "----");
    message += "-\n|";
    for(let columnIndex in board[rowIndex]) {
      if(board[rowIndex][columnIndex] === false) message += " X |";
      else if((userLocation || []).join(",") === [rowIndex,columnIndex].join(",")) {
        if(servers[server].dungeonState.userDead)
          message += "»ᴥ«|";
        else
          message += "°ᴥ°|";
      }
      else message += "   |";
    }
    message += "\n";
  }
  board[0].forEach(_ => message += "----");
  message += "-\n";
  message += "```";
  if(servers[server].dungeonState)
    servers[server].dungeonState.lastActivity = new Date();
  bot.sendMessage({to: channelID, message: message});
}
function dungeonMap(server, channelID, args, member) {
  if(!servers[server].board || servers[server].boardGenerated !== (new Date()).getDate() || args === 'reset') {
    servers[server].board = generateDungeon();
    servers[server].boardGenerated = (new Date()).getDate();
  }
  drawDungeon(server, channelID);
}
function moveInDungeon(server, channelID, args, member) {
  let state = servers[server].dungeonState;
  if(!state) return bot.sendMessage({to: channelID, message: `Sorry <@${member}>, you have to enter the dungeon before you can move around in it.`});
  if(member !== state.memberInDungeon) return bot.sendMessage({to: channelID, message: `Sorry <@${member}>, ${state.memberInDungeon} is currently in the dungeon. Try again after their run.`});
  args = args.split(" ");
  const direction = args.shift();
  let userLoc = state.userLocation;
  let board = servers[server].board;
  switch(direction) {
    case "n":
    case "north":
    case "up":
      if(userLoc[0] === 0) return badDirection(channelID, member);
      if(board[userLoc[0]-1][userLoc[1]] === false) return badDirection(channelID, member);
      state.userLocation[0]--;
      break;
    case "e":
    case "east":
    case "right":
      if(userLoc[1] === board[0].length-1) return badDirection(channelID, member);
      if(board[userLoc[0]][userLoc[1]+1] === false) return badDirection(channelID, member);
      state.userLocation[1]++;
      break;
    case "s":
    case "south":
    case "down":
      if(userLoc[0] === board.length-1) return badDirection(channelID, member);
      if(board[userLoc[0]+1][userLoc[1]] === false) return badDirection(channelID, member);
      state.userLocation[0]++;
      break;
    case "w":
    case "west":
    case "left":
      if(userLoc[1] === 0) return badDirection(channelID, member);
      if(board[userLoc[0]][userLoc[1]-1] === false) return badDirection(channelID, member);
      state.userLocation[1]--;
      break;
  }
  let room = board[userLoc[0]][userLoc[1]];
  let fight = Math.random() < room.fightChance,
      loot = Math.random() < room.lootChance,
      gems = Math.random() < room.gemChance,
      ores = Math.random() < room.oreChance,
      win = Math.random() < Math.random();
  if(fight && !win) return uDed(server, channelID, member);
  if(loot) {
    loot = rollDice(6, room.level);
    state.loot.gold += loot;
  }
  if(gems) {
    gems = 1*room.level;
    state.loot.gems += gems;
  }
  if(ores) {
    ores = 1*room.level;
    state.loot.ores += ores;
  }
  let message = `You move to the next room\n`;
  if(fight) message += `You come across a ${monsters[Math.floor(Math.random()*monsters.length)]} and defeat it!\n`;
  if(loot || gems || ores) message += `You have found:\n`;
  else message += `You found nothing.\n`;
  if(loot) message += `${loot} gold.\n`
  if(gems) message += `${gems} gem${gems > 1 ? 's' : ''}.\n`
  if(ores) message += `${ores} ore${ores > 1 ? 's' : ''}.\n`
  drawDungeon(server, channelID, userLoc, message);
}
function rollDice(sides, times) {
  let total = 0;
  while(times > 0) {
    total += Math.ceil(Math.random()*sides);
    times--;
  }
  return total;
}
function uDed(server, channelID, member) {
  bot.sendMessage({to: channelID, message: `Ambushed by a ${monsters[Math.floor(Math.random()*monsters.length)]}, <@${member}> has died.`});
  servers[server].dungeonState.userDead = true;
  drawDungeon(server, channelID, servers[server].dungeonState.userLocation);
  delete servers[server].dungeonState;
}
function badDirection(channelID, member) {
  return bot.sendMessage({to: channelID, message: `You cannot go that way <@${member}>.`});
}
function enterDungeon(server, channelID, args, member) {
  if(!servers[server].dungeonState)
    servers[server].dungeonState = {};
  let state = servers[server].dungeonState;
  if(state.memberInDungeon) 
    if(state.memberInDungeon === member)
      return bot.sendMessage({to: channelID, message: `You are already in the dungeon <@${member}>`});
    else {
      if(state.entered && ((new Date()) - state.entered)/1000 <= 120)
        return bot.sendMessage({to: channelID, message: `Sorry <@${member}>, <@${state.memberInDungeon}> is currently in the dungeon. Try again after their run.`});
      bot.sendMessage({to: channelID, message: `Sure thing <@${member}>, just let me boot <@${state.memberInDungeon}> from their run because they have been inactive for ${((new Date()) - state.lastActivity)/1000} seconds`});
      servers[server].dungeonState = {};
      state = servers[server].dungeonState;
    }
  state.memberInDungeon = member;
  state.entered = new Date();
  state.lastActivity = new Date();
  let entrances = servers[server].board.map(row => row.filter(column => column.type === 'entrance')).filter(row => row.length > 0);
  let rowEntrance = entrances[Math.floor(Math.random()*entrances.length)];
  let entrance = rowEntrance[Math.floor(Math.random()*rowEntrance.length)];
  state.userLocation = entrance.location;
  state.loot = {
    gold: 0,
    gems: 0,
    ores: 0
  };
  drawDungeon(server, channelID, state.userLocation);
}
function exitDungeon(server, channelID, args, member) {
  const state = servers[server].dungeonState;
  if((state || {}).memberInDungeon !== member)
    return bot.sendMessage({to: channelID, message: `You are not even in the dungeon <@${member}>`});
  const userLoc = state.userLocation;
  let roomType = servers[server].board[userLoc[0]][userLoc[1]].type;
  if(roomType !== "entrance" && roomType !== "exit")
    return bot.sendMessage({to: channelID, message: `Sorry <@${member}>, you can only leave the dungeon at an exit or entrance.`});
  let loot = state.loot;
  if(!servers[server].members[member].loot) servers[server].members[member].loot = {gold: 0, gems: 0, ores: 0};
  let memberLoot = servers[server].members[member].loot;
  memberLoot.gold += loot.gold;
  memberLoot.gems += loot.gems;
  memberLoot.ores += loot.ores;
  let message = `<@${member}> has exited the dungeon alive!
They have gained:
${loot.gold} gold
${loot.gems} gems
${loot.ores} ores
Congratulations <@${member}>
`;
delete servers[server].dungeonState;
bot.sendMessage({to: channelID, message: message});
}
function generateRoom(level, loc) {
  let room = Object.assign({}, lastGenerated);
  room.type = roomTypes[Math.floor(Math.random()*roomTypes.length)];
  room.fightChance += Math.random() * 0.01 * level;
  room.lootChance += Math.random() * 0.01 * level;
  room.gemChance += Math.random() * 0.01 * level;
  room.oreChance += Math.random() * 0.01 * level;
  room.level = level;
  room.location = loc
  lastGenerated = Object.assign({}, room);
  return room;
}
function lookAround(b, ri, ci) {
  return [
    ri === 0 ? false : (b[ri-1][ci]),
    ci+1 === b[ri].length ? false : (b[ri][ci+1]),
    ri+1 === b.length ? false : (b[ri+1][ci]),
    ci === 0 ? false : (b[ri][ci-1])
  ];
}
function skillTree(server, channelID, member) {
  const memberid = extractMemberid(member);
  let message = `Skill levels for ${member}:\n${"```"}`;
  for(let skill in servers[server].skills)
    if(servers[server].skills[skill][memberid]) message += `${skill} - ${servers[server].skills[skill][memberid]}\n`;
  message += "```";
  bot.sendMessage({to: channelID, message: message});
}
function findSkill(needle, skillsList) {
  let foundSkill = false;
  for(let skill in skillsList) {
    if(needle.indexOf(skill) !== -1)
      foundSkill = skill;
  }
  return foundSkill;
}
function extractMemberid(member) {
  return member.replace('<@','').replace('>','').replace("!", "");
}
function serverSkills(server, channelID) {
  let message = `Current skills on this server:\n - `;
  let skills = Object.keys(servers[server].skills);
  message += skills.join('\n - ');
  bot.sendMessage({to: channelID, message: message});
}
function levelUp(server, channelID, args, sender) {
  let foundSkill = findSkill(args, servers[server].skills);
  if(!foundSkill) return bot.sendMessage({to: channelID, message: `Sorry <@${sender}>, I'm afraid I can't do that. That skill does not exist.`});
  const skill = foundSkill;
  args = args.replace(foundSkill, '').trim();
  const member = args;
  const memberid = extractMemberid(member)
  if(!servers[server].skills[skill]) return bot.sendMessage({to: channelID, message: `Sorry <@${sender}>, I'm afraid I can't do that. ${skill} does not exist.`});
  servers[server].skills[skill][memberid]++;
  bot.sendMessage({to: channelID, message: `${skill} for ${member} is now ${servers[server].skills[skill][memberid]}`});
}
function checkSkill(server, channelID, args, sender) {
  let foundSkill = findSkill(args, servers[server].skills);
  if(!foundSkill) return bot.sendMessage({to: channelID, message: `Sorry <@${sender}>, I'm afraid I can't do that. That skill does not exist.`});
  const skill = foundSkill;
  args = args.replace(foundSkill, '').trim();
  const member = args;
  const memberid = extractMemberid(member)
  if(!servers[server].skills[skill]) return bot.sendMessage({to: channelID, message: `Sorry ${sender}, I'm afraid I can't do that. ${skill} does not exist.`});
  bot.sendMessage({to: channelID, message: `${skill} for ${member} is ${servers[server].skills[skill][memberid]}`});
}
function newSkill(server, channelID, skill, sender) {
  if(!servers[server].skills) servers[server].skills = {};
  if(servers[server].skills[skill]) return bot.sendMessage({to: channelID, message: `Woah woah woah <@${sender}>, we've already got a skill named ${skill}`});
  servers[server].skills[skill] = {};
  for(member of Object.keys(servers[server].members)) {
    if(member !== bot.id)
      servers[server].skills[skill][member] = Math.floor(Math.random()*4)+1;
  }
  let message = `adding the skill ${skill}\n`;
  for(member of Object.keys(servers[server].skills[skill]))
    message += `<@${member}>: ${servers[server].skills[skill][member]}\n`
  bot.sendMessage({to: channelID, message: message});
}