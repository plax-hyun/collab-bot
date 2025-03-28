
// Discord.js v14 봇 구현
const { Client, GatewayIntentBits, Partials, ChannelType, PermissionsBitField, SlashCommandBuilder, Routes } = require('discord.js');
const { config } = require('dotenv');
const { REST } = require('@discordjs/rest');

config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel]
});

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

let pendingRequests = new Map();

client.once('ready', () => {
  console.log(`✅ ${client.user.tag}로 로그인했습니다`);
});

// 나머지 코드는 collab-bot.env 파일에서 옮겨왔습니다
[이하 동일한 코드...]
