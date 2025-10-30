const { 
    Client, 
    Events, 
    GatewayIntentBits, 
    ApplicationCommandOptionType, 
    EmbedBuilder 
} = require('discord.js');
const { GiveawaysManager } = require('discord-giveaways');
require("dotenv").config();

//-----------------------------------------------//
// ⚙️ KHỞI TẠO CLIENT
//-----------------------------------------------//
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions
    ]
});

//-----------------------------------------------//
// ⏰ HÀM CHUYỂN THỜI GIAN
//-----------------------------------------------//
function formatTime(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / 1000 / 60) % 60);
    const hours = Math.floor((ms / 1000 / 60 / 60) % 24);
    const days = Math.floor(ms / 1000 / 60 / 60 / 24);
    const parts = [];
    if (days > 0) parts.push(`${days} ngày`);
    if (hours > 0) parts.push(`${hours} giờ`);
    if (minutes > 0) parts.push(`${minutes} phút`);
    if (seconds > 0) parts.push(`${seconds} giây`);
    return parts.join(', ');
}

//-----------------------------------------------//
// 🎁 KHỞI TẠO GIVEAWAYS MANAGER
//-----------------------------------------------//
const manager = new GiveawaysManager(client, {
    storage: './giveaways.json',
    default: {
        botsCanWin: false,
        embedColor: '#FF1493',
        embedColorEnd: '#000000',
        reaction: '<a:1261960933270618192:1433286685189341204>',
        lastChance: {
            enabled: true,
            content: '⏰ **HẾT GIỜ** ⏰',
            threshold: 5000,
            embedColor: '#FF0000'
        },
        winnerCount: 1,
        exemptMembers: () => false,
        isDrop: false
    }
});
client.giveawaysManager = manager;

//-----------------------------------------------//
// 🚀 BOT READY + ĐĂNG KÝ LỆNH
//-----------------------------------------------//
client.once(Events.ClientReady, async (readyClient) => {
    console.log(`✅ Bot đã sẵn sàng! (${readyClient.user.tag})`);

    await client.application.commands.set([
        {
            name: 'giveaway',
            description: 'Tạo một giveaway mới',
            options: [
                { name: 'time', description: 'Thời gian (vd: 1m, 1h, 1d)', type: ApplicationCommandOptionType.String, required: true },
                { name: 'winners', description: 'Số người chiến thắng', type: ApplicationCommandOptionType.Integer, required: true },
                { name: 'prize', description: 'Phần thưởng hoặc mô tả', type: ApplicationCommandOptionType.String, required: true }
            ]
        },
        {
            name: 'avatar',
            description: 'Xem avatar của ai đó hoặc chính bạn',
            options: [
                { name: 'user', description: 'Chọn người dùng', type: ApplicationCommandOptionType.User, required: false }
            ]
        }
    ]);

    console.log('✅ Slash command đã đăng ký!');
});

//-----------------------------------------------//
// 🎉 LỆNH /GIVEAWAY
//-----------------------------------------------//
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isCommand()) return;

    // 🔹 LỆNH AVATAR
    if (interaction.commandName === 'avatar') {
        const user = interaction.options.getUser('user') || interaction.user;
        const avatarEmbed = new EmbedBuilder()
            .setTitle(`🖼️ Avatar của ${user.username}`)
            .setImage(user.displayAvatarURL({ size: 1024, dynamic: true }))
            .setColor('#FF69B4')
            .setFooter({ text: `Yêu cầu bởi ${interaction.user.tag}` });
        return interaction.reply({ embeds: [avatarEmbed] });
    }

    // 🔹 LỆNH GIVEAWAY
    if (interaction.commandName !== 'giveaway') return;
    const ms = require('ms');

    if (!interaction.member.permissions.has('ManageMessages'))
        return interaction.reply({ content: '❌ Bạn không có quyền tạo giveaway!', ephemeral: true });

    const duration = ms(interaction.options.getString('time'));
    const winnerCount = interaction.options.getInteger('winners');
    const prize = interaction.options.getString('prize');

    if (!duration || duration > ms('7d'))
        return interaction.reply({ content: '❌ Thời gian không hợp lệ (tối đa 7 ngày).', ephemeral: true });

    // 🧱 Chống spam tạo 2 lần
    if (interaction.client.activeGiveawayUser === interaction.user.id) {
        return interaction.reply({ content: '⚠️ Bạn đang tạo giveaway khác, hãy chờ hoàn tất.', ephemeral: true });
    }
    interaction.client.activeGiveawayUser = interaction.user.id;

    await interaction.deferReply({ ephemeral: true });

    // 🔢 Sinh mã giveaway 10 số
    const code = Math.floor(1000000000 + Math.random() * 9000000000).toString();

    // 🎁 Tạo giveaway
    const giveaway = await client.giveawaysManager.start(interaction.channel, {
        duration,
        winnerCount,
        prize,
        hostedBy: interaction.user.toString(),
        data: { code, ownerId: interaction.user.id },
        messages: {
            giveaway:
                '<a:1255341894687260775:1433317867293642858>\n' +
                '💫🌸 **Ｇ Ｉ Ｖ Ｅ Ａ Ｗ Ａ Ｙ** 🌸💫\n' +
                '<a:1261960933270618192:1433286685189341204>',

            giveawayEnded:
                '<a:1255341894687260775:1433317867293642858>\n' +
                '🌙💫 **Ｇ Ｉ Ｖ Ｅ Ａ Ｗ Ａ Ｙ Đ Ã  K Ế T  T H Ú C** 💫🌙\n' +
                '<a:1261960933270618192:1433286685189341204>',

            embedTitle: '**{this.prize}**',
            embedDescription:
                '<a:12553406462486160061:1433317989406605383> Nhấn biểu tượng <a:1261960933270618192:1433286685189341204> bên dưới để tham gia!\n' +
                '⏳ Đếm ngược: **{duration}**\n' +
                '🎀 Tổ chức bởi: {this.hostedBy}',

            thumbnail: null,
            embedColor: '#FFB6C1',
            embedFooter: '🎁 Số lượng giải: {this.winnerCount}',

            noWinner: '😭 Giveaway kết thúc nhưng không có người tham gia hợp lệ!',
            winners: '👑 Người chiến thắng:',
            endedAt: '⏰ Kết thúc vào',
            winMessage: '🎉 {winners} đã thắng **{this.prize}**! 🎊',
            hostedBy: '🎀 Tổ chức bởi: {this.hostedBy}',
            units: { seconds: 'giây', minutes: 'phút', hours: 'giờ', days: 'ngày' }
        }
    });

    // 💌 Gửi mã riêng qua DM
    let sent = false;
    try {
        await interaction.user.send(
            `🎟️ **MÃ GIVEAWAY CỦA BẠN:** \`${code}\`\n` +
            `📦 Phần thưởng: ${prize}\n` +
            `🕒 Thời gian: ${formatTime(duration)}\n\n` +
            `Lệnh quản lý:\n` +
            `• \`!fix ${code}\` → chỉnh sửa\n` +
            `• \`!stop ${code}\` → dừng\n` +
            `• \`!random ${code}\` → random lại`
        );
        sent = true;
    } catch { sent = false; }

    await interaction.editReply({
        content:
            `✅ Giveaway đã được tạo thành công!\n` +
            (sent
                ? `💌 Mã giveaway đã được gửi riêng qua DM.`
                : `⚠️ Không thể gửi DM — đây là mã của bạn: **${code}**`) +
            `\n📜 Dùng \`!fix ${code}\`, \`!stop ${code}\`, hoặc \`!random ${code}\` để quản lý.`
    });

    delete interaction.client.activeGiveawayUser;
});

//-----------------------------------------------//
// 🧩 LỆNH QUẢN LÝ GIVEAWAY BẰNG MÃ
//-----------------------------------------------//
function findGiveawayByCode(manager, code) {
    return manager.giveaways.find(g => g.data && g.data.code === code);
}

client.on(Events.MessageCreate, async message => {
    if (message.author.bot) return;

    const args = message.content.trim().split(/ +/);
    const command = args.shift()?.toLowerCase();
    const code = args[0];
    if (!code) return;

    const giveaway = findGiveawayByCode(client.giveawaysManager, code);
    if (!giveaway || message.author.id !== giveaway.data.ownerId) return;

    const ms = require('ms');

    if (command === '!fix') {
        const text = args.slice(1).join(' ');
        let newPrize = giveaway.prize, newWinners = giveaway.winnerCount, addTime = 0;
        if (text.includes('prize')) newPrize = text.split('prize = ')[1] || newPrize;
        if (text.includes('winners')) newWinners = parseInt(text.split('winners = ')[1]) || newWinners;
        if (text.includes('time')) addTime = ms(text.split('time = ')[1]) || 0;
        await client.giveawaysManager.edit(giveaway.messageId, { newPrize, newWinnerCount: newWinners, addTime });
        return message.reply(`✅ Đã chỉnh sửa giveaway **${code}**!`);
    }

    if (command === '!stop') {
        await client.giveawaysManager.end(giveaway.messageId);
        return message.reply(`🛑 Giveaway **${code}** đã bị dừng.`);
    }

    if (command === '!random') {
        await client.giveawaysManager.reroll(giveaway.messageId);
        return message.reply(`🎲 Giveaway **${code}** đã được random lại.`);
    }
});

//-----------------------------------------------//
// 🔄 LỆNH KHỞI ĐỘNG LẠI BOT
//-----------------------------------------------//
client.on(Events.MessageCreate, async message => {
    if (message.author.bot) return;
    if (message.content === '!restart' && message.author.id === '1409222785154416651') {
        await message.reply('🔄 Bot đang khởi động lại...');
        process.exit(0);
    }
});

client.login(process.env.TOKEN).catch(err => console.error('❌ Lỗi đăng nhập:', err.message));
