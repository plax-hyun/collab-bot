
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

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, options, user, guild } = interaction;

  if (commandName === '협업요청') {
    const target = options.getUser('대상');
    if (!target) return interaction.reply({ content: '대상을 지정해주세요.', ephemeral: true });

    pendingRequests.set(target.id, { requester: user.id });

    try {
      await target.send(`📨 **${user.tag}** 님이 협업을 요청했습니다!
수락하려면 \`/수락 ${user.id}\` 명령어를 이 DM에서 입력하세요.
거절하려면 \`/거절 ${user.id}\` 을 입력해주세요.`);

      await interaction.reply({ content: `✅ ${target.tag}에게 협업 요청을 보냈습니다.`, ephemeral: true });
    } catch (e) {
      await interaction.reply({ content: `❌ ${target.tag}님에게 DM을 보낼 수 없습니다.`, ephemeral: true });
    }

  } else if (commandName === '수락') {
    const requesterId = options.getString('요청자');
    const requester = await client.users.fetch(requesterId);
    const request = pendingRequests.get(user.id);

    if (!request || request.requester !== requesterId) {
      return interaction.reply({ content: '❌ 유효하지 않은 요청입니다.', ephemeral: true });
    }

    const guild = await client.guilds.fetch(GUILD_ID);
    const guildMemberA = await guild.members.fetch(requesterId);
    const guildMemberB = await guild.members.fetch(user.id);

    const channel = await guild.channels.create({
      name: `🤝｜협업-${guildMemberA.displayName}-${guildMemberB.displayName}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: requesterId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
      ]
    });

    await channel.send(`🎉 협업 채널이 생성되었습니다!
<@${requesterId}>와 <@${user.id}>님, 자유롭게 대화를 나눠주세요.`);
    pendingRequests.delete(user.id);

    await interaction.reply({ content: '✅ 협업을 수락하셨고, 전용 채널이 생성되었습니다.', ephemeral: true });

  } else if (commandName === '거절') {
    const requesterId = options.getString('요청자');
    pendingRequests.delete(user.id);
    await interaction.reply({ content: '🚫 협업 요청을 거절하셨습니다.', ephemeral: true });
    const requester = await client.users.fetch(requesterId);
    try {
      await requester.send(`❌ ${user.tag}님이 협업 요청을 거절하셨습니다.`);
    } catch (e) {}

  } else if (commandName === '협업완료') {
    const channel = interaction.channel;
    if (channel.name.startsWith('🤝｜협업')) {
      await interaction.reply('📦 협업 채널을 아카이빙합니다.');
      await channel.setArchived(true);
    } else {
      await interaction.reply({ content: '❌ 협업 채널이 아닙니다.', ephemeral: true });
    }
  }
});

const commands = [
  new SlashCommandBuilder()
    .setName('협업요청')
    .setDescription('작가에게 협업 요청을 보냅니다.')
    .addUserOption(opt => opt.setName('대상').setDescription('협업 대상').setRequired(true)),
  new SlashCommandBuilder()
    .setName('수락')
    .setDescription('협업 요청을 수락합니다.')
    .addStringOption(opt => opt.setName('요청자').setDescription('요청자의 ID').setRequired(true)),
  new SlashCommandBuilder()
    .setName('거절')
    .setDescription('협업 요청을 거절합니다.')
    .addStringOption(opt => opt.setName('요청자').setDescription('요청자의 ID').setRequired(true)),
  new SlashCommandBuilder()
    .setName('협업완료')
    .setDescription('협업을 완료하고 채널을 정리합니다.')
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log('📡 슬래시 명령어 등록 중...');
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body: commands,
    });
    console.log('✅ 슬래시 명령어가 등록되었습니다');
  } catch (error) {
    console.error(error);
  }
})();

client.login(TOKEN);
