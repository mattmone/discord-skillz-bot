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
  console.log(message);
  if (message.indexOf(`<@${bot.id}>`) === -1) return;
  console.log('checking for possible command:', message);
  let commandMatch = /(new skill|check skill|level up|server skills) (.+)/gi.exec(message);
  if(commandMatch === null) return;
  commandMatch.shift();
  const [command, args] = commandMatch;
  console.log(command, args);
  if(!commands[command]) return bot.sendMessage({to: channelID, message: `sorry, I don't understand.`});
  commands[command](event.d.guild_id, channelID, args);
  setTimeout(_ => {
    fs.writeFile('./data/servers.json', JSON.stringify(servers), _ => {
      console.log('wrote to servers.json');
    });
  }, 1500);
}); 

const commands = {
  "new skill": newSkill,
  "check skill": checkSkill,
  "level up": levelUp
};
function serverSkills(server, channelID) {
  let message = `Current skills on this server:\n`;
  let skills = Object.keys(servers[server].skills);
  message += skills.join(', ');
  bot.sendMessage({to: channelID, message: message});
}
function levelUp(server, channelID, args) {
  let foundSkill;
  for(let skill in servers[server].skills) {
    if(args.indexOf(skill) !== -1)
      foundSkill = skill;
  }
  if(!foundSkill) return bot.sendMessage({to: channelID, message: `Sorry, I'm afraid I can't do that. ${skill} does not exist.`});
  const skill = foundSkill;
  args = args.replace(foundSkill, '').trim();
  const member = args;
  const memberid = member.replace('<@','').replace('>','').replace("!", "");
  if(!servers[server].skills[skill]) return bot.sendMessage({to: channelID, message: `Sorry ${member}, I'm afraid I can't do that. ${skill} does not exist.`});
  servers[server].skills[skill][memberid]++;
  bot.sendMessage({to: channelID, message: `${skill} for ${member} is now ${servers[server].skills[skill][memberid]}`});
}
function checkSkill(server, channelID, args) {
  let foundSkill;
  for(let skill in servers[server].skills) {
    if(args.indexOf(skill) !== -1)
      foundSkill = skill;
  }
  if(!foundSkill) return bot.sendMessage({to: channelID, message: `Sorry, I'm afraid I can't do that. ${skill} does not exist.`});
  const skill = foundSkill;
  args = args.replace(foundSkill, '').trim();
  const member = args;
  const memberid = member.replace('<@','').replace('>','').replace("!", "");
  if(!servers[server].skills[skill]) return bot.sendMessage({to: channelID, message: `Sorry ${member}, I'm afraid I can't do that. ${skill} does not exist.`});
  bot.sendMessage({to: channelID, message: `${skill} for ${member} is ${servers[server].skills[skill][memberid]}`});
}
function newSkill(server, channelID, skill) {
  if(!servers[server].skills) servers[server].skills = {};
  if(servers[server].skills[skill]) return bot.sendMessage({to: channelID, message: `We've already got a skill named ${skill}`});
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