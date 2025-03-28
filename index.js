
import { Client, GatewayIntentBits, Partials, ChannelType, PermissionsBitField, ButtonBuilder, ButtonStyle, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, Events, SlashCommandBuilder, Routes } from 'discord.js';
import { config } from 'dotenv';
import { REST } from '@discordjs/rest';

config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isChatInputCommand()) {
    const { commandName, options, user, guild } = interaction;

    if (commandName === '협업요청') {
      const target = options.getUser('대상');
      if (!target) {
        await interaction.reply({ content: '❌ 대상을 지정해주세요.', flags: 64 });
        return;
      }
      const guildMemberA = await guild.members.fetch(user.id);
      const guildMemberB = await guild.members.fetch(target.id);

      const channel = await guild.channels.create({
        name: `${guildMemberA.displayName}-${guildMemberB.displayName}`,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          { id: guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: target.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
          { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
        ]
      });

      const acceptButton = new ButtonBuilder()
        .setCustomId(`accept-${user.id}`)
        .setLabel('수락')
        .setStyle(ButtonStyle.Success);

      const rejectButton = new ButtonBuilder()
        .setCustomId(`reject-${user.id}`)
        .setLabel('거절')
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder().addComponents(acceptButton, rejectButton);

      await channel.send({
        content: `<@${target.id}>님, <@${user.id}>님의 협업을 요청하셨습니다. 
      협업 수락 여부를 선택해주세요! 자유롭게 결정해주시면 됩니다.`,
        components: [row]
      });

      await interaction.reply({ content: `✅ <@${target.id}>님에게 협업 요청을 전달했습니다. \n상대방의 일정, 상황에 따라 협업이 거절될 수 있습니다. 상대방이 수락하면 협업방에 초대드립니다.`, flags: 64 });
    }
  }

  if (interaction.isButton()) {
    const [action, requesterId] = interaction.customId.split('-');
    const requester = await client.users.fetch(requesterId);
    const channel = interaction.channel;

    if (action === 'accept') {
      await interaction.update({
        content: `🎉 협업이 시작되었습니다!
        <@${requesterId}> 님, <@${interaction.user.id}> 님의 창작 대화방입니다. \n알플레이의 도움이 필요한 경우엔 호출해주시고, 자유롭게 대화 하시면 됩니다. ^^ \n알플레이는 창작자들을 언제나 응원합니다!`,
        components: []
      });
      await channel.permissionOverwrites.edit(requesterId, {
        ViewChannel: true,
        SendMessages: true
      });
    } else if (action === 'reject') {
      const modal = new ModalBuilder()
        .setCustomId(`reject-reason-${requesterId}`)
        .setTitle('거절 사유 입력');

      const input = new TextInputBuilder()
        .setCustomId('reason')
        .setLabel('거절 사유 (선택사항)')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false);

      const actionRow = new ActionRowBuilder().addComponents(input);
      modal.addComponents(actionRow);
      await interaction.showModal(modal);
    }
  }

  if (interaction.isModalSubmit()) {
    const [mainAction, subAction, requesterId] = interaction.customId.split('-');
    if (mainAction === 'reject' && subAction === 'reason') {
      const reason = interaction.fields.getTextInputValue('reason') || '사유 없음';
      const channel = interaction.channel;

      await interaction.deferUpdate();

      try {
        const requester = await client.users.fetch(requesterId);
        await requester.send(`아쉽게도 <@${interaction.user.id}>님이 협업 요청을 거절하셨습니다.다른 분에게 협업을 요청해보세요!\n사유: ${reason}`);
      } catch (e) {
        console.error('DM 전송 실패:', e);
      }

      setTimeout(() => channel.delete(), 3000);
    }
  }
});

const commands = [
  new SlashCommandBuilder()
    .setName('협업요청')
    .setDescription('원하는 창작자에게 협업 요청을 보냅니다.')
    .addUserOption(opt => opt.setName('대상').setDescription('협업 대상').setRequired(true))
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log('🧹 기존 명령어 제거 중...');
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: [] });
    console.log('✅ 기존 명령어 제거 완료');

    console.log('📡 새로운 명령어 등록 중...');
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body: commands,
    });
    console.log('✅ 새로운 Slash 명령어 등록 완료');
  } catch (error) {
    console.error(error);
  }
})();

client.login(TOKEN);
