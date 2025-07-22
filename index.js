import express from 'express';
import { Client, GatewayIntentBits, Partials, ChannelType, PermissionsBitField, ButtonBuilder, ButtonStyle, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, Events, SlashCommandBuilder, Routes } from 'discord.js';
import { config } from 'dotenv';
import { REST } from '@discordjs/rest';
import cron from 'node-cron';
import winston from 'winston';

// 환경 변수 로드
config();

// Express 서버 설정 (Render 헬스체크 및 UptimeRobot용)
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('🤖 Bot is alive!');
});

app.get('/health', (req, res) => {
  if (client.isReady()) {
    res.status(200).send('Bot is healthy');
  } else {
    res.status(503).send('Bot is down');
  }
});

app.listen(PORT, () => {
  console.log(`🌐 KeepAlive server running on port ${PORT}`);
});

// Winston 로깅 설정
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error', maxsize: 5 * 1024 * 1024, maxFiles: 5 }),
    new winston.transports.File({ filename: 'combined.log', maxsize: 5 * 1024 * 1024, maxFiles: 5 }),
    new winston.transports.Console()
  ]
});

// 디스코드 클라이언트 설정
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

const GROUP_CHAT_CATEGORIES = [
  '978917835231354900',
  '1119132516708790314',
  '1132846859124224120',
  '1132872038646829056',
  '1206851587817873478',
  '1237282787342680118',
  '1239387200404193342',
  '1279967959317614692',
  '1290886138378194995',
  '1311883311790030879',
  '1331136233354694747'
];

// 채널 정리 함수
async function cleanOldChannels() {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const channels = await guild.channels.fetch();
    const threeMonthsAgo = Date.now() - 1000 * 60 * 60 * 24 * 90;

    for (const [channelId, channel] of channels) {
      if (
        channel.type === ChannelType.GuildText &&
        GROUP_CHAT_CATEGORIES.includes(channel.parentId)
      ) {
        try {
          const messages = await channel.messages.fetch({ limit: 1 });
          const lastMessage = messages.first();

          if (!lastMessage || lastMessage.createdTimestamp < threeMonthsAgo) {
            await channel.delete();
            logger.info(`🗑️ 삭제된 채널: ${channel.name}`);
          }
        } catch (e) {
          logger.error(`메시지 확인 실패 - ${channel.name}`, { error: e.message });
        }
      }
    }
  } catch (e) {
    logger.error('채널 정리 중 오류', { error: e.message });
  }
}

// 봇 준비 완료 이벤트
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  logger.info(`Bot logged in as ${client.user.tag}`);

  // 초기 채널 정리
  await cleanOldChannels();

  // 매일 자정에 채널 정리 스케줄링
  cron.schedule('0 0 * * *', cleanOldChannels);
});

// 예외 처리
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', { error: err.message });
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection', { reason: reason.message || reason });
});

// 인터랙션 처리
client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isChatInputCommand()) {
    const { commandName, options, user, guild } = interaction;

    if (commandName === '협업요청') {
      await interaction.deferReply({ ephemeral: true });

      try {
        const target = options.getUser('대상');
        if (!target) {
          await interaction.editReply({ content: '❌ 대상을 지정해주세요.' });
          return;
        }

        const guildMemberA = await guild.members.fetch(user.id);
        const guildMemberB = await guild.members.fetch(target.id);

        let selectedCategory = null;
        for (const categoryId of GROUP_CHAT_CATEGORIES) {
          const childCount = guild.channels.cache.filter(c => c.parentId === categoryId).size;
          if (childCount < 50) {
            selectedCategory = categoryId;
            break;
          }
        }

        if (!selectedCategory) {
          await interaction.editReply({ content: '⚠️ 모든 카테고리가 가득 찼습니다. 관리자에게 문의하세요.' });
          return;
        }

        const channel = await guild.channels.create({
          name: `${guildMemberA.displayName}-${guildMemberB.displayName}`,
          type: ChannelType.GuildText,
          parent: selectedCategory,
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
          content: `<@${target.id}>님, <@${user.id}>님의 협업을 요청하셨습니다. \n협업 수락 여부를 선택해주세요! 자유롭게 결정해주시면 됩니다.`,
          components: [row]
        });

        await interaction.editReply({
          content: `✅ <@${target.id}>님에게 협업 요청을 전달했습니다. \n상대방의 일정, 상황에 따라 협업이 거절될 수 있습니다. 상대방이 수락하면 협업방에 초대드립니다.`
        });

      } catch (err) {
        logger.error('협업 요청 처리 중 오류', { error: err.message });
        await interaction.editReply({
          content: '⚠️ 협업 요청 처리 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.'
        });
      }
    }
  }

  if (interaction.isButton()) {
    const [action, requesterId] = interaction.customId.split('-');
    const channel = interaction.channel;

    try {
      const requester = await client.users.fetch(requesterId);

      if (action === 'accept') {
        await interaction.update({
          content: `🎉 협업이 시작되었습니다!\n<@${requesterId}> 님, <@${interaction.user.id}> 님의 창작 대화방입니다. \n알플레이의 도움이 필요한 경우엔 호출해주시고, 자유롭게 대화 하시면 됩니다. ^^ \n알플레이는 창작자들을 언제나 응원합니다!`,
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
    } catch (e) {
      logger.error('버튼 인터랙션 처리 중 오류', { error: e.message });
      await interaction.update({ content: '⚠️ 버튼 처리 중 오류가 발생했습니다.', components: [] });
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
        await requester.send(`아쉽게도 <@${interaction.user.id}>님이 협업 요청을 거절하셨습니다. 다른 분에게 협업을 요청해보세요!\n사유: ${reason}`);
      } catch (e) {
        logger.error('DM 전송 실패', { error: e.message });
        await channel.send(`<@${requesterId}>님에게 DM 전송에 실패했습니다. 거절 사유: ${reason}`);
      }

      setTimeout(() => {
        channel.delete().catch(e => logger.error('채널 삭제 실패', { error: e.message }));
      }, 3000);
    }
  }
});

// 슬래시 명령어 등록
const commands = [
  new SlashCommandBuilder()
    .setName('협업요청')
    .setDescription('원하는 창작자에게 협업 요청을 보냅니다.')
    .addUserOption(opt => opt.setName('대상').setDescription('협업 대상').setRequired(true))
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10', timeout: 1000 }).setToken(TOKEN);

(async () => {
  try {
    console.log('🧹 기존 명령어 제거 중...');
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: [] });
    console.log('✅ 기존 명령어 제거 완료');

    console.log('📡 새로운 명령어 등록 중...');
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('✅ 새로운 Slash 명령어 등록 완료');
  } catch (error) {
    logger.error('명령어 등록 실패', { error: error.message });
  }
})();

// 봇 로그인
client.login(TOKEN).catch(err => {
  logger.error('봇 로그인 실패', { error: err.message });
});
