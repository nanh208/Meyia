
const { Client, Events, GatewayIntentBits, ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');
const { GiveawaysManager } = require('discord-giveaways');
require("dotenv").config();

// Khởi tạo client với các intents cần thiết
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions
    ]
});

// Hàm chuyển đổi thời gian
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

// Khởi tạo GiveawaysManager
const manager = new GiveawaysManager(client, {
    storage: './giveaways.json',
    default: {
        botsCanWin: false,
        embedColor: '#FF1493',
        embedColorEnd: '#000000',
        // Reaction (icon users should react with to enter) — use provided participation emoji
        reaction: '<a:1261960933270618192:1433286685189341204>',
        lastChance: {
            enabled: true,
            content: '⏰ **HẾT GIỜ** ⏰',
            threshold: 5000,
            embedColor: '#FF0000'
        },
        winnerCount: 1, // Mặc định 1 người thắng
        exemptPermissions: [], // Không loại trừ ai
        exemptMembers: () => false, // Không loại trừ thành viên nào
        isDrop: false, // Không phải drop mode (first-come-first-serve)
    }
});
client.giveawaysManager = manager;

// Event handler khi bot sẵn sàng
client.once(Events.ClientReady, async (readyClient) => {
    console.log(`✅ Bot đã sẵn sàng! Đăng nhập với tên ${readyClient.user.tag}`);
    
    // Đăng ký lệnh slash commands
    const giveawayCommand = {
        name: 'giveaway',
        description: 'Tạo một giveaway mới',
        options: [
            {
                name: 'time',
                description: 'Thời gian giveaway (vd: 1m, 1h, 1d, 1w)',
                type: ApplicationCommandOptionType.String,
                required: true
            },
            {
                name: 'winners',
                description: 'Số người chiến thắng',
                type: ApplicationCommandOptionType.Integer,
                required: true
            },
            {
                name: 'prize',
                description: 'Phần thưởng/Chú thích cho giveaway',
                type: ApplicationCommandOptionType.String,
                required: true
            }
        ]
    };

    try {
        // Prepare both commands
        const avatarsCommand = {
            name: 'avatars',
            description: 'Hiển thị avatar của người được chọn',
            options: [
                {
                    name: 'user',
                    description: 'Chọn người dùng để xem avatar (mặc định là bạn)',
                    type: ApplicationCommandOptionType.User,
                    required: false
                }
            ]
        };

        const commands = [giveawayCommand, avatarsCommand];

        // Chỉ đăng ký global commands để tránh duplicate
        await client.application.commands.set(commands);

        // Xóa các lệnh đã đăng ký trên từng guild (nếu có) để tránh hiển thị trùng lặp
        // Một vài server có thể còn lưu lệnh dạng guild-scoped; xoá chúng để chỉ dùng global
        for (const [guildId, guild] of client.guilds.cache) {
            try {
                await guild.commands.set([]);
            } catch (err) {
                // Nếu bot không có quyền trên guild hoặc lỗi khác, log và tiếp tục
                console.warn(`Không thể xóa lệnh của guild ${guildId}:`, err.message);
            }
        }

        console.log('✅ Đã đăng ký lệnh slash commands thành công!');
    } catch (error) {
        console.error('❌ Lỗi khi đăng ký slash command:', error);
    }
});

// Xử lý slash commands
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === 'giveaway') {
        // Kiểm tra quyền của người dùng
        if (!interaction.member.permissions.has('ManageMessages')) {
            return interaction.reply({
                content: '❌ Bạn không có quyền tạo giveaway!',
                ephemeral: true
            });
        }

        const duration = interaction.options.getString('time');
        const winnerCount = interaction.options.getInteger('winners');
        const prize = interaction.options.getString('prize');

        // Chuyển đổi thời gian từ string sang milliseconds
        const ms = require('ms');
        const durationMs = ms(duration);

        if (!durationMs || durationMs > ms('7d')) {
            return interaction.reply({
                content: '❌ Thời gian không hợp lệ! Vui lòng sử dụng định dạng: 1m, 1h, 1d (tối đa 7 ngày)',
                ephemeral: true
            });
        }

        if (winnerCount < 1) {
            return interaction.reply({
                content: '❌ Số người chiến thắng phải lớn hơn 0!',
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        // Tạo embed cho giveaway (Cute Pastel style)
        const giveawayEmbed = new EmbedBuilder()
            .setColor(0xFFB6C1)
            .setTitle('🌸 GIVEAWAY DỄ THƯƠNG 🌸')
            .setDescription(`${prize}\n\nThời gian: ${formatTime(durationMs)}\nSố người chiến thắng: ${winnerCount}\n\nNhấn vào icon để tham gia nha`)
                // Use a larger size for the thumbnail so the avatar appears bigger in the embed
                .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 2048 }))
            .setFooter({ 
                text: `🎀 Pastel Giveaway - Tổ chức bởi: ${interaction.user.tag}`, 
                iconURL: interaction.user.displayAvatarURL({ dynamic: true })
            })
            .setTimestamp(Date.now() + durationMs);

        // Tạo giveaway mới
        client.giveawaysManager.start(interaction.channel, {
            duration: durationMs,
            winnerCount: winnerCount, // Đảm bảo số người thắng đúng với input
            prize,
            hostedBy: interaction.user.toString(),
            embedColor: '#FF1493',
            embedColorEnd: '#000000',
            // Provide a larger thumbnail and an image version so the giveaway post shows a bigger avatar
            thumbnail: interaction.user.displayAvatarURL({ dynamic: true, size: 2048 }),
            image: interaction.user.displayAvatarURL({ dynamic: true, size: 2048 }),
            exemptPermissions: [], // Không loại trừ ai
            exemptMembers: () => false, // Không loại trừ thành viên nào
            messages: {
                // Use the provided giveaway header emoji and participation emoji
                giveaway: '<a:1255341894687260775:1433317867293642858> **GIVEAWAY** <a:1255341894687260775:1433317867293642858>',
                giveawayEnded: '<a:1255341894687260775:1433317867293642858> **GIVEAWAY ĐÃ KẾT THÚC** <a:1255341894687260775:1433317867293642858>',
                // Add a clock icon to the countdown so it's more visible
                timeRemaining: '⏰ Thời gian còn lại: **{duration}**',
                inviteToParticipate: 'Nhấn vào icon để tham gia nha',
                winMessage: '<a:1255341894687260775:1433317867293642858> Chúc mừng {winners}! Bạn đã thắng **{this.prize}**! <a:1255341894687260775:1433317867293642858>',
                embedFooter: '{this.winnerCount} người thắng',
                noWinner: 'Giveaway đã kết thúc, không có người tham gia hợp lệ 😔',
                hostedBy: '👑 Tổ chức bởi: {this.hostedBy}',
                winners: '<a:1261960933270618192:1433286685189341204> Người chiến thắng:',
                endedAt: '⏰ Kết thúc vào',
                drawing: '⏰ Còn: {timestamp}',
                dropMessage: 'Hãy là người đầu tiên react 🎉 để thắng!',
                units: {
                    seconds: 'giây',
                    minutes: 'phút',
                    hours: 'giờ',
                    days: 'ngày'
                }
            }
        });

        await interaction.editReply({
            content: '✅ Đã tạo giveaway thành công!',
            ephemeral: true
        });
    }

    if (interaction.commandName === 'avatars') {
        // Get the user option (or default to the interaction user)
        const target = interaction.options.getUser('user') || interaction.user;

        // Build avatar URLs in different formats
        const pngUrl = target.displayAvatarURL({ extension: 'png', size: 1024, dynamic: true });
        const jpgUrl = target.displayAvatarURL({ extension: 'jpg', size: 1024, dynamic: true });
        const webpUrl = target.displayAvatarURL({ extension: 'webp', size: 1024, dynamic: true });

        const avatarEmbed = new EmbedBuilder()
            .setTitle(`Avatar for ${target.tag}`)
            .setDescription(`Link as\n[png](${pngUrl}) | [jpg](${jpgUrl}) | [webp](${webpUrl})`)
            .setImage(pngUrl)
            .setFooter({ text: "You can now change Carl-bot's profile picture and banner with premium!!" })
            .setColor('#2F3136');

        return interaction.reply({ embeds: [avatarEmbed] });
    }
});

// Xử lý lỗi kết nối
client.on('error', error => {
    console.error('Lỗi kết nối Discord:', error);
});

// Đăng nhập vào Discord
client.login(process.env.TOKEN).catch(error => {
    console.error('❌ Lỗi đăng nhập:', error.message);
    console.log('⚠️ Hãy kiểm tra lại TOKEN trong file .env');
});