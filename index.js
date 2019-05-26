const Discord = require("discord.io");
const logger = require("winston");
const auth = require("./auth.json");
const fs = require('fs');
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
    servers[server].members = Object.assign(bot.servers[server].members);
  }
  logger.info(servers);
});
bot.on("message", function(user, userID, channelID, message, event) {
  //listen for bot mention
  if (message.indexOf(`<@${bot.id}>`) === -1 && message.indexOf(`<@!${bot.id}>`) === -1) return;
  let commandMatch = /(new skill|check skill|level up|server skills|skill tree|dungeon map) ?(.+)?/gi.exec(message);
  if(commandMatch === null) return;
  commandMatch.shift();
  const [command, args] = commandMatch;
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
  "dungeon map": dungeonMap
};
const roomTypes = [
  "dungeon"
];
function dungeonMap(server, channelID, args, member) {
  const boardSize = 36;
  let board = new Array(boardSize);
  board.map(row => new Array(boardSize));
  board[0][0] = {type: 'entrance', fightChance: .25, lootChance: .25, gemChance: 0, oreChance: 0};
  board[0][1] = Math.random() >= 0.25;
  board[1][0] = !board[0][1] ? true : Math.random() > 0.5;
  for(let rowIndex in board) {
    let row = board[rowIndex];
    let level = Math.ceil(rowIndex + 1 / 4);
    for(let columnIndex in row) {
      let column = row[columnIndex];
      let rooms = lookAround(board, rowIndex, columnIndex);
      rooms.map(room => {
        if(room === false || (room || {}).type) return room;
        return generateRoom(column, level);
      });
    }
  }
  let message = "Your dungeon map:\n```";
  for(let rowIndex in board) {
    let row = board[rowIndex];
    row.forEach(_ => message += "--");
    message += "-\n|";
    for(let columnIndex in row) {
      let column = row[columnIndex];
      if(column === false) message += "X|";
      else message += " |";
    }
  }
  board[0].forEach(_ => message += "--");
  message += "-\n";
  message += "```";
  bot.sendMessage({to: channelID, message: message});
}
function generateRoom(base, level) {
  let room = Object.assign({}, base);
  room.type = roomTypes[Math.floor(Math.random()*roomTypes.length)];
  room.fightChance += Math.random() * 0.05 * level;
  room.lootChance += Math.random() * 0.05 * level;
  room.gemChance += Math.random() * 0.05 * level;
  room.oreChance += Math.random() * 0.05 * level;
  return room;
}
function lookAround(b, ri, ci) {
  return [
    ri === 0 ? false : (b[ri-1][ci]),
    ci+1 > b[ri].length ? false : (b[ri][ci+1]),
    ri+1 > b.length ? false : (b[ri+1][ci]),
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
function findSkill(needle) {
  let foundSkill = false;
  for(let skill in servers[server].skills) {
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
  let foundSkill = findSkill(args);
  if(!foundSkill) return bot.sendMessage({to: channelID, message: `Sorry ${sender}, I'm afraid I can't do that. That skill does not exist.`});
  const skill = foundSkill;
  args = args.replace(foundSkill, '').trim();
  const member = args;
  const memberid = extractMemberid(member)
  if(!servers[server].skills[skill]) return bot.sendMessage({to: channelID, message: `Sorry ${sender}, I'm afraid I can't do that. ${skill} does not exist.`});
  servers[server].skills[skill][memberid]++;
  bot.sendMessage({to: channelID, message: `${skill} for ${member} is now ${servers[server].skills[skill][memberid]}`});
}
function checkSkill(server, channelID, args, sender) {
  let foundSkill = findSkill(args);
  if(!foundSkill) return bot.sendMessage({to: channelID, message: `Sorry ${sender}, I'm afraid I can't do that. That skill does not exist.`});
  const skill = foundSkill;
  args = args.replace(foundSkill, '').trim();
  const member = args;
  const memberid = extractMemberid(member)
  if(!servers[server].skills[skill]) return bot.sendMessage({to: channelID, message: `Sorry ${sender}, I'm afraid I can't do that. ${skill} does not exist.`});
  bot.sendMessage({to: channelID, message: `${skill} for ${member} is ${servers[server].skills[skill][memberid]}`});
}
function newSkill(server, channelID, skill, sender) {
  if(!servers[server].skills) servers[server].skills = {};
  if(servers[server].skills[skill]) return bot.sendMessage({to: channelID, message: `Woah woah woah ${sender}, we've already got a skill named ${skill}`});
  servers[server].skills[skill] = {};
  for(member of Object.keys(servers[server].members)) {
    if(member !== bot.id)
      servers[server].skills[skill][member] = Math.floor(Math.random()*4)+1;
  }
  let message = `adding the skill ${skill}\n`;
  for(member of Object.keys(servers[server].skills[skill]))
    message += `${servers[server].members[member].username}: ${servers[server].skills[skill][member]}\n`
  bot.sendMessage({to: channelID, message: message});
}