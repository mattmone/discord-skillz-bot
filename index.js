const Discord = require("discord.io");
const logger = require("winston");
const auth = require("./auth.json");
const fs = require("fs");
const { createCanvas, loadImage } = require("canvas");
const { monsters } = require("./constants/denizens.js");
const { roomTemplates, roomTypes, roomSize } = require("./constants/rooms.js");
const { posString, posNumbers } = require('./utilities/position.js');
const { checkForExclusions, checkForRequireds } = require('./utilities/checks.js');
const { melee, range, spells } = require('./items/weapons.js');
const imagemin = require('imagemin');
const imageminPngquant = require('imagemin-pngquant');

(async () => {
  let floor = await loadImage("./floor-20.jpg");
  let character = await loadImage("./character.png");
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
  let messages = [];
  let fileMessage = false;
  bot.on("ready", function(event) {
    bot.setPresence({ game: { name: "Dungeon Master", type: 0 } });
    bot.editUserInfo({ avatar: fs.readFileSync("./bot-avatar.jpg", "base64") });
    logger.info("Connected");
    logger.info("Logged in as: ");
    logger.info(bot.username + " - (" + bot.id + ")");
    if (fs.existsSync("./data/servers.json"))
      servers = JSON.parse(fs.readFileSync("./data/servers.json"));
    updateMembers();
  });
  bot.on("message", async function(user, userID, channelID, message, event) {
    //listen for bot mention
    if (userID === bot.id) return;
    if(!servers[event.d.guild_id].members[userID]) updateMembers();
    let commandMatch;
    if (channelID == 580758335519850506 || channelID == 581255423164940290) {
      console.log(message);
      commandMatch = /^(new skill|check skill|level up|server skills|skill tree|dungeon map|enter dungeon|(?:dungeon )?move|show loot|random dungeon|rando(?: dungo)?|go|⬇|⬆|⬅|➡|⤵|⤴|🆕|💰|shop|buy|show inventory) ?(.+)?/gi.exec(
        message
      );
    } else {
      if (
        message.indexOf(`<@${bot.id}>`) === -1 &&
        message.indexOf(`<@!${bot.id}>`) === -1
      )
        return;
      commandMatch = /(new skill|check skill|level up|server skills|skill tree|random dungeon|go) ?(.+)?/gi.exec(
        message
      );
    }
    if (commandMatch === null) return;
    commandMatch.shift();
    let [command, args] = commandMatch;
    command = command.toLowerCase();
    console.log(command, args || "");
    if (!commands[command])
      return messages.push(`sorry, I don't understand.`);
    await commands[command](event.d.guild_id, channelID, args, userID);
    clearTimeout(servers.writing);
    servers.writing = setTimeout(_ => {
      fs.writeFile("./data/servers.json", JSON.stringify(servers), _ => {
        console.log("wrote to servers.json");
      });
    }, 1500);
    if (!fileMessage)
      bot.sendMessage({ to: channelID, message: messages.join("\n") });
    else bot.uploadFile({to: channelID, message: messages.join("\n"), file: fileMessage});
    fileMessage = false;
    messages = [];
  });

  function updateMembers() {
    for (server in bot.servers) {
      if (!servers[server]) servers[server] = {};
      let members = Object.assign({}, bot.servers[server].members);
      if (!servers[server].members) servers[server].members = members;
      for (let member of Object.values(members)) {
        if (
          Object.keys(servers[server].members).filter(m => member.id === m)
            .length === 0
        ) {
          servers[server].members[member.id] = Object.assign({}, member);
        }
      }
    }
  }
  const commands = {
    "new skill": newSkill,
    "check skill": checkSkill,
    "level up": levelUp,
    "server skills": serverSkills,
    "skill tree": skillTree,
    "dungeon map": drawInstance,
    "enter dungeon": newInstance,
    "dungeon move": goToDungeonRoom,
    "move": goToDungeonRoom,
    "shop": listItems,
    "buy": buyItem,
    // "exit dungeon": exitDungeon,
    // "leave dungeon": exitDungeon,
    "show loot": showLoot,
    "show inventory": showInventory,
    "💰": showLoot,
    "random dungeon": newInstance,
    go: goToDungeonRoom,
    rando: newInstance,
    "rando dungo": newInstance,
    "🆕": newInstance,
    "⬆": (a, b, c, d) => {
      return goToDungeonRoom(a, b, `n ${c || ""}`, d);
    },
    "⬇": (a, b, c, d) => {
      return goToDungeonRoom(a, b, `s ${c || ""}`, d);
    },
    "⬅": (a, b, c, d) => {
      return goToDungeonRoom(a, b, `w ${c || ""}`, d);
    },
    "➡": (a, b, c, d) => {
      return goToDungeonRoom(a, b, `e ${c || ""}`, d);
    },
    "⤵": (a, b, c, d) => {
      return goToDungeonRoom(a, b, `d ${c || ""}`, d);
    },
    "⤴": (a, b, c, d) => {
      return goToDungeonRoom(a, b, `u ${c || ""}`, d);
    }
  };

  let lastGenerated;
  async function showLoot(server, channelID, args, member) {
    if (!servers[server].members[member].loot)
      servers[server].members[member].loot = { gold: 0, gems: 0, ores: 0 };
    let { loot } = servers[server].members[member];
    let message = `<@${member}>'s current loot:
  ${loot.gold} gold
  ${loot.gems} gems
  ${loot.ores} ores`;
    messages.push(message);
  }
  function listItem(item, totalSpace) {
    let spaceLength = totalSpace - item.type.length - `${item.cost}`.length - `${item.level}`.length - `${item.modifier}`.length - 6;
    let listing = `| ${item.type}${' '.repeat(spaceLength)}${item.level}D${item.modifier} ${item.cost} |`;
    return listing;
  }
  async function listItems(server, channelID, args, member) {
    messages.push('```');
    const itemLength = 34;
    messages.push('-'.repeat(itemLength));
    let [ type, category ] = (args || '0 0').split(' ');
    
    switch(type) {
      case "weapon":
      case "weapons":
        switch(category) {
          case "melee":
            melee.forEach(weapon => {messages.push(listItem(weapon, itemLength))});
            break;
          case "range":
            range.forEach(weapon => {messages.push(listItem(weapon, itemLength))});
            break;
          case "spells":
            spells.forEach(weapon => {messages.push(listItem(weapon, itemLength))});
            break;
          default:
            messages.push(`What kind of weapons? I have melee, range, and spells.`);
            break;
        }
        break;
      case "armor":
        messages.push(`Sorry, there is no armor yet, check back later.`)
        break;
      case "rings":
        messages.push(`Sorry, there are no rings yet, check back later.`)
        break;
      default:
        messages.push(`What are you shopping for? You can choose weapons, armor, or rings.`);
        break;
    }
    messages.push('-'.repeat(itemLength));
    messages.push('```');
  }
  async function buyItem(server, channelID, args, member) {
    if(!servers[server].members[member].items) servers[server].members[member].items = {};
    let { items, loot } = servers[server].members[member];
    let shopCommands = (args || '0 0 0').split(' ');
    let type = shopCommands.shift();
    let category = shopCommands.shift();
    let item = shopCommands.join(' ');
    let desired;
    switch(type) {
      case 'weapon':
      case 'weapons':
        if(!items.weapons) items.weapons = [];
        switch(category) {
          case 'melee':
            [ desired ] = melee.filter(m => m.type === item);
            if(!desired) {
              messages.push(`You said you were looking for a ${item || 'weapon'}, but I don't see that here.`);
              break;
            }
            if(loot.gold < desired.cost) {
              messages.push(`Sorry, but that costs ${desired.cost} gold and you only have ${loot.gold} gold.`);
              break;
            }
            items.weapons.unshift(Object.assign({}, desired));
            loot.gold -= desired.cost;
            messages.push(`You have bought a ${item}.`);
            break;
          case 'range':
          case 'ranged':
            [ desired ] = range.filter(m => m.type === item);
            if(!desired) {
              messages.push(`You said you were looking for a ${item || 'weapon'}, but I don't see that here.`);
              break;
            }
            if(loot.gold < desired.cost) {
              messages.push(`Sorry, but that costs ${desired.cost} gold and you only have ${loot.gold} gold.`);
              break;
            }
            loot.gold -= desired.cost;
            items.weapons.unshift(Object.assign({}, desired));
            messages.push(`You have bought a ${item}.`);
            break;
          case 'spell':
          case 'spells':
            [ desired ] = spells.filter(m => m.type === item);
            if(!desired) {
              messages.push(`You said you were looking for a ${item || 'spell'}, but I don't see that here.`);
              break;
            }
            if(loot.gold < desired.cost) {
              messages.push(`Sorry, but that costs ${desired.cost} gold and you only have ${loot.gold} gold.`);
              break;
            }
            loot.gold -= desired.cost;
            items.weapons.unshift(Object.assign({}, desired));
            messages.push(`You have bought a ${item}.`);
            break;
          default:
            messages.push(`What type of weapon are you trying to buy? There are melee, ranged, and spells`);
            break;
        }
        break;
      case 'armor':
      case 'armour':
        messages.push(`Sorry, there is no armor to buy yet. Check back later.`)
        break;
      case 'ring':
      case 'rings':
        messages.push(`Sorry, there are no rings to buy yet. Check back later.`)
        break;
      default:
        messages.push(`What type of item are you trying to buy? You can choose weapon, armor, or ring.`);
        break;
    }
  }
  async function showInventory(server, channelID, args, member) {
    messages.push('```');
    let { items } = servers[server].members[member];
    messages.push(`${'-'.repeat(5)}WEAPONS${'-'.repeat(21)}`);
    if(items.weapons) items.weapons.forEach(item => messages.push(listItem(item, 34)));
    else messages.push(`| none${' '.repeat(27)}|`);
    messages.push(`${'-'.repeat(5)}ARMOR${'-'.repeat(23)}`);
    if(items.armor) items.armor.forEach(item => messages.push(listItem(item, 34)));
    else messages.push(`| none${' '.repeat(27)}|`);
    messages.push(`${'-'.repeat(5)}RINGS${'-'.repeat(23)}`);
    if(items.rings) items.rings.forEach(item => messages.push(listItem(item, 34)));
    else messages.push(`| none${' '.repeat(27)}|`);
    messages.push('```');
  }
  async function drawInstance(server) {
    return new Promise((resolve, reject) => {
      const state = servers[server].dState;
      const { dungeon, userLocation } = state;
      const canvasSize = roomSize * 15;
      const canvas = createCanvas(canvasSize, canvasSize);
      const ctx = canvas.getContext("2d");
      const openingSize = 1 / 4;
      ctx.lineWidth = 2;
      ctx.translate(canvasSize / 2, canvasSize / 2);
      let dungeonArr = [];
      for (let room in dungeon) {
        dungeon[room].location = room;
        dungeonArr.push(dungeon[room]);
      }
      dungeonArr.sort((a, b) => (a.type > b.type ? 1 : -1));
      for (let room of dungeonArr) {
        let roomCoords = room.location;
        const [x, y] = roomCoords
          .split(",")
          .map(coord => parseInt(coord) * roomSize);
        const [top, right, bottom, left] = [
          y - roomSize / 2,
          x + roomSize / 2,
          y + roomSize / 2,
          x - roomSize / 2
        ];
        // const room = dungeon[roomCoords];
        ctx.strokeStyle = "#FFF";
        if (room.type === "entrance") ctx.strokeStyle = "#FFD700";
        if (room.type === "exit") ctx.strokeStyle = "#F00";
        ctx.drawImage(floor, left, top, roomSize, roomSize);

        ctx.beginPath();
        ctx.moveTo(left, top);
        if (room.exits[0] === 1) {
          ctx.lineTo(left + roomSize * openingSize, top);
          ctx.moveTo(left + roomSize * (1 - openingSize), top);
        }
        ctx.lineTo(right, top);
        if (room.exits[1] === 1) {
          ctx.lineTo(right, top + roomSize * openingSize);
          ctx.moveTo(right, top + roomSize * (1 - openingSize));
        }
        ctx.lineTo(right, bottom);
        if (room.exits[2] === 1) {
          ctx.lineTo(left + roomSize * (1 - openingSize), bottom);
          ctx.moveTo(left + roomSize * openingSize, bottom);
        }
        ctx.lineTo(left, bottom);
        if (room.exits[3] === 1) {
          ctx.lineTo(left, top + roomSize * (1 - openingSize));
          ctx.moveTo(left, top + roomSize * openingSize);
        }
        ctx.lineTo(left, top);
        ctx.stroke();
        if (roomCoords === userLocation) {
          if (state.dead) {
            ctx.fillStyle = "#777";
            ctx.fillRect(
              left + roomSize * openingSize,
              top + roomSize * openingSize,
              roomSize - roomSize * openingSize * 2,
              roomSize - roomSize * openingSize * 2
            );
          } else
            ctx.drawImage(
              character,
              left + roomSize * openingSize,
              top + roomSize * openingSize
            );
        }
      }

      const out = fs.createWriteStream(__dirname + "/dungeon/canvas/dungeon.png");
      const stream = canvas.createPNGStream();
      stream.pipe(out);
      out.on("finish", async _ => {
        let files = await imagemin(['./dungeon/canvas/dungeon.png'], './dungeon/min/', {plugins: [imageminPngquant()]});
        messages.push(`Dungeon Level ${state.level}`);
        fileMessage = __dirname + "/dungeon/min/dungeon.png";
        return resolve();
      });
    });
  }
  async function newInstance(server, channelID, args, member) {
    if (servers[server].dState) {
      if(!(new Date()) - (servers[server].dState.entered || (new Date('2019-06-01'))) > 120000)
        return messages.push(`Sorry <@${member}>, <@${servers[server].dState.member}> is already playing and to avoid confusion only 1 map may be played at a time.`);
    }
    servers[server].dState = {
      member: member,
      gold: 0,
      ores: 0,
      gems: 0,
      dead: false,
      entered: new Date()
    };
    if (!servers[server].members[member].loot)
      servers[server].members[member].loot = { gold: 0, gems: 0, ores: 0 };
    if (!servers[server].members[member].items)
      servers[server].members[member].items = {weapons: [], armor: [], rings: []};
    servers[server].dState.items = {
      weapon: [...(servers[server].members[member].items.weapons || []) ].splice(0,1)[0],
      armor: [...(servers[server].members[member].items.armor || []) ].splice(0,1)[0],
      rings: [...(servers[server].members[member].items.rings || [])].splice(0,2)
    };
    messages.push(`You come across the Ancient Man's hut after searching for ${Math.ceil(Math.random()*4)+1} hours.`);
    messages.push(`the Ancient Man meets you at the door with a grin on his face, like he has been waiting for you.`);
    messages.push(`He walks out the front door immediatly with an exclaimation of "\`Rando Dungo\`!" and off he heads into the woods.`);
    messages.push(`You scramble to keep up, following his cut trail, and a short time later, you are standing before the entrance of \`Rando Dungo\`.`);
    if(servers[server].dState.items.weapon)
      messages.push(`Checking the straps of your trusty ${servers[server].dState.items.weapon.type}, you enter \`Rando Dungo\`!`);
    else
      messages.push(`Excited for the adventure ahead, you enter \`Rando Dungo\`!`);
    servers[server].dState.userLocation = startLevel(servers[server].dState, 1);
    return await drawInstance(server);
  }
  function startLevel(state, level) {
    state.dungeon = {};
    state.dungeonExit = false;
    let dungeon = state.dungeon;
    state.level = level || 1;
    dungeon["0,0"] = {
      exits: generateMapRoom({ minimumExits: 1, maximumExits: 2 }),
      type: "entrance"
    };
    return "0,0";
  }
  function checkForModifiers(items, type) {
    let modifier = 0;
    switch(type) {
      case "lose":
        if(items.weapon)
          modifier += rollDice(items.weapon.modifier, items.weapon.level);
        if(items.armor)
          modifier += rollDice(items.armor.modifier, items.armor.level);
        break;
    }
    return modifier;
  }
  function resolveChance(items, type, level, increase) {
    let chanceComputation = {
      fight: rollDice(4, level),
      lose: rollDice(4, level),
      gold: rollDice(10, level) + (increase ? rollDice(10, level) : 0),
      ores: rollDice(4, level) + (increase ? rollDice(4, level) : 0),
      gems: rollDice(4, level) + (increase ? rollDice(4, level) : 0)
    };
    let modifier = checkForModifiers(items, type);
    let yourRoll = rollDice(20,1);
    let yourTotal =  yourRoll + modifier;
    let monsterRoll = chanceComputation[type];
    console.log(type, ':', 'You', yourRoll, 'modifier', modifier, 'Them', monsterRoll);
    const resolution =  yourTotal < monsterRoll;
    if(type === 'lose') {
      if(!resolution) messages.push(`${"```CSS\n"}You rolled a ${yourRoll} ${modifier ? `and have a modifier of ${modifier}, so you have a total of ${yourTotal} ` : ''}which wins against the monster's ${monsterRoll}.${"\n```"}`);
      else messages.push(`${"```HTTP\n"}You lost! You rolled a ${yourRoll} ${modifier ? `and even modified with ${modifier} you got a ${yourTotal}` : ''}, which doesn't beat the monster's ${monsterRoll}.${"\n```"}`);
    }
    return resolution;
  }
  function exitInstance(state, channelID, member, server) {
    const { level, gold, ores, gems, dead, entered } = state;
    if(!servers[server].members[member].timeInDungeon)
      servers[server].members[member].timeInDungeon = 0;
    servers[server].members[member].timeInDungeon += (new Date()) - entered;
    if (dead)
      messages.push(
        `Ambushed by a ${monsters[Math.floor(Math.random() * monsters.length)]}, <@${member}> has died.
What a bummer, you were at level ${level} and lost your dungeon loot:
${gold} gold
${gems} gems
${ores} ores`
      );
    else
    messages.push(
        `Congratulations <@${member}> you have exited the dungeon alive!
You travelled all the way to level ${level} and gained:
${gold} gold
${gems} gems
${ores} ores`
      );
    if (!servers[server].members[member])
      servers[server].members[member] = { loot: {} };
    if (!servers[server].members[member].loot)
      servers[server].members[member].loot = {};
    let memberLoot = servers[server].members[member].loot;
    if (!dead) {
      memberLoot.gold += parseInt(gold, 10);
      memberLoot.gems += parseInt(gems, 10);
      memberLoot.ores += parseInt(ores, 10);
    }
    setTimeout(_ => {
      delete servers[server].dState;
    }, 500);
  }
  async function goToDungeonRoom(server, channelID, args, member) {
    const state = servers[server].dState;
    if (!state)
      return messages.push(
        `<@${member}>, you are not currently in a dungeon.`
      );
    if (state.member !== member)
      return messages.push(`<@${state.member}> is currently in the dungeon. <@${member}>, please wait your turn.`);
    const uLoc = posNumbers(state.userLocation);
    let userLocation;
    let generationOptions;
    const dungeon = state.dungeon;
    if (!args) return messages.push("Go where?");
    args = args.split(" ");
    const direction = args.shift();
    console.log(args);
    switch (direction) {
      case "d":
      case "down":
        if (dungeon[state.userLocation].type !== "exit")
          return badDirection(channelID, member);
        state.level++;
        userLocation = startLevel(state, state.level);
        break;
      case "u":
      case "up":
      case "out":
        if (dungeon[state.userLocation].type !== "entrance")
          return badDirection(channelID, member);
        return exitInstance(state, channelID, member, server);
        break;
      case "n":
      case "north":
      case "up":
        if (dungeon[state.userLocation].exits[0] === 0)
          return badDirection(channelID, member);
        uLoc[1]--;
        userLocation = posString(uLoc);
        break;
      case "e":
      case "east":
      case "right":
        if (dungeon[state.userLocation].exits[1] === 0)
          return badDirection(channelID, member);
        uLoc[0]++;
        userLocation = posString(uLoc);
        break;
      case "s":
      case "south":
      case "down":
        if (dungeon[state.userLocation].exits[2] === 0)
          return badDirection(channelID, member);
        uLoc[1]++;
        userLocation = posString(uLoc);
        break;
      case "w":
      case "west":
      case "left":
        if (dungeon[state.userLocation].exits[3] === 0)
          return badDirection(channelID, member);
        uLoc[0]--;
        userLocation = posString(uLoc);
        break;
      default:
        return badDirection(channelID, member);
        break;
    }
    let fight,
      lose = false;
    if (!dungeon[userLocation]) {
      const dungeonRooms = Object.keys(dungeon).length
      let minExits = Math.round(-1/64*Math.pow(dungeonRooms,2)+2);
      let maxExits = Math.round(-1/128*Math.pow(dungeonRooms,2)+4);
      if(minExits < 1) minExits = 1;
      if(maxExits < 1) maxExits = 1;
      generationOptions = {
        minimumExits: minExits,
        requiredExits: checkForRequireds(dungeon, uLoc, state.userLocation),
        excludedExits: checkForExclusions(dungeon, uLoc, state.userLocation),
        maximumExits: maxExits
      };
      let type = roomTypes[Math.floor(Math.random() * roomTypes.length)];
      if(dungeonRooms > 5 && state.dungeonExit === false) {
        let exitPoss = ['exit', ...roomTypes];
        type = exitPoss[Math.floor(Math.random() * exitPoss.length)];
        if(type === 'exit') {
          generationOptions.minimumExits = 1;
          generationOptions.maximumExits = 1;
          state.dungeonExit = true;
        }
      }
      if(generationOptions.maximumExits < generationOptions.requiredExits.length) generationOptions.maximumExits = generationOptions.requiredExits.length;
      dungeon[userLocation] = {
        exits: generateMapRoom(generationOptions),
        type: type
      };
      console.log(generationOptions, dungeon[userLocation]);
      let {items, level} = state;
      fight = resolveChance(items, "fight", level);
      if (fight) lose = resolveChance(items, "lose", level);
      if (!lose) {
        const roomGold = resolveChance(items, "gold", level, fight)
          ? rollDice(6, fight ? level * 2 : level)
          : 0;
        const roomOres = resolveChance(items, "ores", level, fight)
          ? rollDice(4, fight ? level * 2 : level)
          : 0;
        const roomGems = resolveChance(items, "gems", level, fight)
          ? rollDice(2, fight ? level * 2 : level)
          : 0;
        let message = "";
        if (fight)
          message += `<@${member}>, you fought a level ${level} ${
            monsters[Math.floor(Math.random() * monsters.length)]
          } and won!\n`;
        if (roomGold > 0)
          message += `You found ${roomGold} gold in this room!\n`;
        if (roomOres > 0)
          message += `You found ${roomOres} ores in this room!\n`;
        if (roomGems > 0)
          message += `You found ${roomGems} gems in this room!\n`;
        messages.push(message);
        state.gold += parseInt(roomGold, 10);
        state.ores += parseInt(roomOres, 10);
        state.gems += parseInt(roomGems, 10);
      } else if (fight) {
        state.dead = true;
        exitInstance(state, channelID, member, server);
      }
    }
    state.userLocation = userLocation;
    if (args.join(" ").match(/⬇|⬆|⬅|➡|⤵|⤴/gi) && state.dead === false) {
      return commands[args.shift()](server, channelID, args.join(" "), member);
    }
    await drawInstance(server, channelID);
  }
  function generateMapRoom(options) {
    let { minimumExits, requiredExits, maximumExits, excludedExits } = options;
    if (requiredExits)
      for (required of requiredExits)
        excludedExits = excludedExits.filter(exclude => exclude !== required);
    let filteredRooms = roomTemplates.filter(
      exits => exits.reduce((total, num) => total + num) >= (minimumExits > 4 ? 4 : minimumExits)
    );
    if (excludedExits)
      for (exclude of excludedExits)
        filteredRooms = filteredRooms.filter(exits => exits[exclude] === 0);
    if (maximumExits >= 0)
      filteredRooms = filteredRooms.filter(
        exits => exits.reduce((total, num) => total + num) <= maximumExits
      );
    if (requiredExits)
      for (required of requiredExits)
        filteredRooms = filteredRooms.filter(exits => exits[required] === 1);
    return filteredRooms[Math.floor(Math.random() * filteredRooms.length)];
  }
  function generateDungeon() {
    const boardSize = 10;
    let board = "0"
      .repeat(boardSize)
      .split("")
      .map(row =>
        "0"
          .repeat(boardSize)
          .split("")
          .map(column => {
            return {};
          })
      );
    board[0][0] = {
      type: "entrance",
      fightChance: 0.25,
      lootChance: 0.25,
      gemChance: 0,
      oreChance: 0,
      location: [0, 0]
    };
    lastGenerated = Object.assign({}, board[0][0]);
    board[0][1] = Math.random() >= 0.25 ? generateRoom(1, [0, 1]) : false;
    board[1][0] = !board[0][1]
      ? generateRoom(1, [1, 0])
      : Math.random() > 0.5
      ? generateRoom(1, [1, 0])
      : false;
    for (let rowIndex = 0; rowIndex < board.length; rowIndex++) {
      let level = Math.ceil((rowIndex + 1) / 2);
      for (
        let columnIndex = 0;
        columnIndex < board[rowIndex].length;
        columnIndex++
      ) {
        let connectorGenerated = false;
        if (rowIndex !== 0)
          if (
            board[rowIndex - 1][columnIndex] !== false &&
            !board[rowIndex - 1][columnIndex].type
          )
            if (Math.random() <= 0.25) {
              board[rowIndex - 1][columnIndex] = generateRoom(level, [
                rowIndex - 1,
                columnIndex
              ]);
              connectorGenerated = true;
            } else board[rowIndex - 1][columnIndex] = false;
        if (columnIndex !== 0)
          if (
            board[rowIndex][columnIndex - 1] !== false &&
            !board[rowIndex][columnIndex - 1].type
          )
            if (Math.random() <= 0.25) {
              board[rowIndex][columnIndex - 1] = generateRoom(level, [
                rowIndex,
                columnIndex - 1
              ]);
              connectorGenerated = true;
            } else board[rowIndex][columnIndex - 1] = false;
        if (rowIndex + 1 !== board.length)
          if (
            board[rowIndex + 1][columnIndex] !== false &&
            !board[rowIndex + 1][columnIndex].type
          )
            if (Math.random() <= 0.5) {
              board[rowIndex + 1][columnIndex] = generateRoom(level, [
                rowIndex + 1,
                columnIndex
              ]);
              connectorGenerated = true;
            } else board[rowIndex + 1][columnIndex] = false;
        if (columnIndex + 1 !== board[rowIndex].length)
          if (
            board[rowIndex][columnIndex + 1] !== false &&
            !board[rowIndex][columnIndex + 1].type
          )
            if (Math.random() <= 0.75 || !connectorGenerated) {
              board[rowIndex][columnIndex + 1] = generateRoom(level, [
                rowIndex,
                columnIndex + 1
              ]);
            } else board[rowIndex][columnIndex + 1] = false;
      }
    }
    for (let rowIndex = 0; rowIndex < board.length; rowIndex++) {
      for (
        let columnIndex = 0;
        columnIndex < board[rowIndex].length;
        columnIndex++
      ) {
        if (
          board[rowIndex][columnIndex] === false ||
          board[rowIndex][columnIndex].type
        )
          continue;
        board[rowIndex][columnIndex] = false;
      }
    }
    return board;
  }
  function drawDungeon(server, channelID, userLocation, premessage) {
    let board = servers[server].board;
    let message = premessage ? premessage + "\n" : "";
    if (userLocation)
      message += `You are in a ${
        board[userLocation[0]][userLocation[1]].type
      } room, level ${board[userLocation[0]][userLocation[1]].level}.`;
    else message += "Today's dungeon map:";
    message += "\n```\n";
    for (let rowIndex in board) {
      board[rowIndex].forEach(_ => (message += "----"));
      message += "-\n|";
      for (let columnIndex in board[rowIndex]) {
        if (board[rowIndex][columnIndex] === false) message += " X |";
        else if (
          (userLocation || []).join(",") === [rowIndex, columnIndex].join(",")
        ) {
          if (servers[server].dungeonState.userDead) message += "»ᴥ«|";
          else message += "°ᴥ°|";
        } else message += "   |";
      }
      message += "\n";
    }
    board[0].forEach(_ => (message += "----"));
    message += "-\n";
    message += "```";
    if (servers[server].dungeonState)
      servers[server].dungeonState.lastActivity = new Date();
    messages.push(message);
  }
  function dungeonMap(server, channelID, args, member) {
    if (
      !servers[server].board ||
      servers[server].boardGenerated !== new Date().getDate() ||
      args === "reset"
    ) {
      servers[server].board = generateDungeon();
      servers[server].boardGenerated = new Date().getDate();
    }
    drawDungeon(server, channelID);
  }
  function moveInDungeon(server, channelID, args, member) {
    let state = servers[server].dungeonState;
    if (!state)
      return messages.push(`Sorry <@${member}>, you have to enter the dungeon before you can move around in it.`);
    if (member !== state.memberInDungeon)
      return messages.push(`Sorry <@${member}>, ${state.memberInDungeon} is currently in the dungeon. Try again after their run.`);
    args = args.split(" ");
    const direction = args.shift();
    let userLoc = state.userLocation;
    let board = servers[server].board;
    switch (direction) {
      case "n":
      case "north":
      case "up":
        if (userLoc[0] === 0) return badDirection(channelID, member);
        if (board[userLoc[0] - 1][userLoc[1]] === false)
          return badDirection(channelID, member);
        state.userLocation[0]--;
        break;
      case "e":
      case "east":
      case "right":
        if (userLoc[1] === board[0].length - 1)
          return badDirection(channelID, member);
        if (board[userLoc[0]][userLoc[1] + 1] === false)
          return badDirection(channelID, member);
        state.userLocation[1]++;
        break;
      case "s":
      case "south":
      case "down":
        if (userLoc[0] === board.length - 1)
          return badDirection(channelID, member);
        if (board[userLoc[0] + 1][userLoc[1]] === false)
          return badDirection(channelID, member);
        state.userLocation[0]++;
        break;
      case "w":
      case "west":
      case "left":
        if (userLoc[1] === 0) return badDirection(channelID, member);
        if (board[userLoc[0]][userLoc[1] - 1] === false)
          return badDirection(channelID, member);
        state.userLocation[1]--;
        break;
    }
    let room = board[userLoc[0]][userLoc[1]];
    let fight = Math.random() < room.fightChance,
      loot = Math.random() < room.lootChance,
      gems = Math.random() < room.gemChance,
      ores = Math.random() < room.oreChance,
      lose = Math.random() < Math.random();
    if (fight && lose) return uDed(server, channelID, member);
    if (loot) {
      loot = rollDice(6, room.level);
      state.loot.gold += parseInt(loot, 10);
    }
    if (gems) {
      gems = 1 * room.level;
      state.loot.gems += parseInt(gems, 10);
    }
    if (ores) {
      ores = 1 * room.level;
      state.loot.ores += parseInt(ores, 10);
    }
    let message = `You move to the next room\n`;
    if (fight)
      message += `You come across a ${
        monsters[Math.floor(Math.random() * monsters.length)]
      } and defeat it!\n`;
    if (loot || gems || ores) message += `You have found:\n`;
    else message += `You found nothing.\n`;
    if (loot) message += `${loot} gold.\n`;
    if (gems) message += `${gems} gem${gems > 1 ? "s" : ""}.\n`;
    if (ores) message += `${ores} ore${ores > 1 ? "s" : ""}.\n`;
    drawDungeon(server, channelID, userLoc, message);
  }
  function rollDice(sides, times) {
    let total = 0;
    while (times > 0) {
      total += Math.ceil(Math.random() * sides);
      times--;
    }
    return total;
  }
  function uDed(server, channelID, member) {
    messages.push(`Ambushed by a ${monsters[Math.floor(Math.random() * monsters.length)]}, <@${member}> has died.`);
    servers[server].dungeonState.userDead = true;
    drawDungeon(server, channelID, servers[server].dungeonState.userLocation);
    delete servers[server].dungeonState;
  }
  function badDirection(channelID, member) {
    return messages.push(`You cannot go that way <@${member}>.`);
  }
  function enterDungeon(server, channelID, args, member) {
    if (!servers[server].dungeonState) servers[server].dungeonState = {};
    let state = servers[server].dungeonState;
    if (state.memberInDungeon)
      if (state.memberInDungeon === member)
        return messages.push(`You are already in the dungeon <@${member}>`);
      else {
        if (state.entered && (new Date() - state.entered) / 1000 <= 120)
          return messages.push(`Sorry <@${member}>, <@${state.memberInDungeon}> is currently in the dungeon. Try again after their run.`);
        messages.push(`Sure thing <@${member}>, just let me boot <@${state.memberInDungeon}> from their run because they have been inactive for ${(new Date() - state.lastActivity) / 1000} seconds`);
        servers[server].dungeonState = {};
        state = servers[server].dungeonState;
      }
    state.memberInDungeon = member;
    state.entered = new Date();
    state.lastActivity = new Date();
    let entrances = servers[server].board
      .map(row => row.filter(column => column.type === "entrance"))
      .filter(row => row.length > 0);
    let rowEntrance = entrances[Math.floor(Math.random() * entrances.length)];
    let entrance = rowEntrance[Math.floor(Math.random() * rowEntrance.length)];
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
    if ((state || {}).memberInDungeon !== member)
      return messages.push(`You are not even in the dungeon <@${member}>`);
    const userLoc = state.userLocation;
    let roomType = servers[server].board[userLoc[0]][userLoc[1]].type;
    if (roomType !== "entrance" && roomType !== "exit")
      return messages.push(`Sorry <@${member}>, you can only leave the dungeon at an exit or entrance.`);
    let loot = state.loot;
    if (!servers[server].members[member].loot)
      servers[server].members[member].loot = { gold: 0, gems: 0, ores: 0 };
    let memberLoot = servers[server].members[member].loot;
    memberLoot.gold += parseInt(loot.gold, 10);
    memberLoot.gems += parseInt(loot.gems, 10);
    memberLoot.ores += parseInt(loot.ores, 10);
    let message = `<@${member}> has exited the dungeon alive!
They have gained:
${loot.gold} gold
${loot.gems} gems
${loot.ores} ores
Congratulations <@${member}>
`;
    delete servers[server].dungeonState;
    messages.push(message);
  }
  function generateRoom(level, loc) {
    let room = Object.assign({}, lastGenerated);
    room.type = roomTypes[Math.floor(Math.random() * roomTypes.length)];
    room.fightChance += Math.random() * 0.01 * level;
    room.lootChance += Math.random() * 0.01 * level;
    room.gemChance += Math.random() * 0.01 * level;
    room.oreChance += Math.random() * 0.01 * level;
    room.level = level;
    room.location = loc;
    lastGenerated = Object.assign({}, room);
    return room;
  }
  function lookAround(b, ri, ci) {
    return [
      ri === 0 ? false : b[ri - 1][ci],
      ci + 1 === b[ri].length ? false : b[ri][ci + 1],
      ri + 1 === b.length ? false : b[ri + 1][ci],
      ci === 0 ? false : b[ri][ci - 1]
    ];
  }
  function skillTree(server, channelID, member) {
    const memberid = extractMemberid(member);
    let message = `Skill levels for ${member}:\n${"```"}`;
    for (let skill in servers[server].skills)
      if (servers[server].skills[skill][memberid])
        message += `${skill} - ${servers[server].skills[skill][memberid]}\n`;
    message += "```";
    messages.push(message);
  }
  function findSkill(needle, skillsList) {
    let foundSkill = false;
    for (let skill in skillsList) {
      if (needle.indexOf(skill) !== -1) foundSkill = skill;
    }
    return foundSkill;
  }
  function extractMemberid(member) {
    return member
      .replace("<@", "")
      .replace(">", "")
      .replace("!", "");
  }
  function serverSkills(server, channelID) {
    let message = `Current skills on this server:\n - `;
    let skills = Object.keys(servers[server].skills);
    message += skills.join("\n - ");
    messages.push(message);
  }
  function levelUp(server, channelID, args, sender) {
    let foundSkill = findSkill(args, servers[server].skills);
    if (!foundSkill)
      return messages.push(`Sorry <@${sender}>, I'm afraid I can't do that. That skill does not exist.`);
    const skill = foundSkill;
    args = args.replace(foundSkill, "").trim();
    const member = args;
    const memberid = extractMemberid(member);
    if (!servers[server].skills[skill])
      return messages.push(`Sorry <@${sender}>, I'm afraid I can't do that. ${skill} does not exist.`);
    servers[server].skills[skill][memberid]++;
    messages.push(`${skill} for ${member} is now ${servers[server].skills[skill][memberid]}`);
  }
  function checkSkill(server, channelID, args, sender) {
    let foundSkill = findSkill(args, servers[server].skills);
    if (!foundSkill)
      return messages.push(`Sorry <@${sender}>, I'm afraid I can't do that. That skill does not exist.`);
    const skill = foundSkill;
    args = args.replace(foundSkill, "").trim();
    const member = args;
    const memberid = extractMemberid(member);
    if (!servers[server].skills[skill])
      return messages.push(`Sorry ${sender}, I'm afraid I can't do that. ${skill} does not exist.`);
    messages.push(`${skill} for ${member} is ${servers[server].skills[skill][memberid]}`);
  }
  function newSkill(server, channelID, skill, sender) {
    if (!servers[server].skills) servers[server].skills = {};
    if (servers[server].skills[skill])
      return messages.push(`Woah woah woah <@${sender}>, we've already got a skill named ${skill}`);
    servers[server].skills[skill] = {};
    for (member of Object.keys(servers[server].members)) {
      if (member !== bot.id)
        servers[server].skills[skill][member] =
          Math.floor(Math.random() * 4) + 1;
    }
    let message = `adding the skill ${skill}\n`;
    for (member of Object.keys(servers[server].skills[skill]))
      message += `<@${member}>: ${servers[server].skills[skill][member]}\n`;
    messages.push(message);
  }
})();
