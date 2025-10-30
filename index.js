const {
    Client,
    Events,
    GatewayIntentBits,
    ApplicationCommandOptionType,
    EmbedBuilder,
    PermissionFlagsBits
} = require("discord.js");
const { GiveawaysManager } = require("discord-giveaways");
const ms = require("ms");
require("dotenv").config();
const { OpenAI } = require("openai");

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

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const OWNER_ID = "1409222785154416651";
let activeChatChannel = null;
let mutedChannels = new Set();
const chatMemory = new Map();

//-----------------------------------------------//
// 🕒 HÀM CHUYỂN THỜI GIAN
//-----------------------------------------------//
function formatTime(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / 1000 / 60) % 60);
    const hours = Math.floor((ms / 1000 / 60 / 60) % 24);
    const days = Math.floor(ms / 1000 / 60 / 60 / 24);
    const parts = [];
    if (days) parts.push(`${days} ngày`);
    if (hours) parts.push(`${hours} giờ`);
    if (minutes) parts.push(`${minutes} phút`);
    if (seconds) parts.push(`${seconds} giây`);
    return parts.join(", ");
}

//-----------------------------------------------//
// 🎁 GIVEAWAY MANAGER
//-----------------------------------------------//
const manager = new GiveawaysManager(client, {
    storage: "./giveaways.json",
    default: {
        botsCanWin: false,
        embedColor: "#FF69B4",
        embedColorEnd: "#000000",
        reaction: "🎀",
        winnerCount: 1
    }
});
client.giveawaysManager = manager;

//-----------------------------------------------//
// 🚀 READY
//-----------------------------------------------//
client.once(Events.ClientReady, async (readyClient) => {
    console.log(`✅ Bot MEYIA đã sẵn sàng (${readyClient.user.tag})`);

    await client.application.commands.set([
        {
            name: "giveaway",
            description: "🎉 Tạo giveaway mới",
            options: [
                { name: "time", description: "Thời gian (vd: 1m, 1h, 1d)", type: ApplicationCommandOptionType.String, required: true },
                { name: "winners", description: "Số người thắng", type: ApplicationCommandOptionType.Integer, required: true },
                { name: "prize", description: "Phần thưởng", type: ApplicationCommandOptionType.String, required: true }
            ]
        },
        {
            name: "avatar",
            description: "🖼️ Xem avatar của ai đó hoặc chính bạn",
            options: [{ name: "user", description: "Người dùng cần xem", type: ApplicationCommandOptionType.User, required: false }]
        },
        {
            name: "chatbot",
            description: "💬 Thiết lập kênh chat cho Meyia",
            options: [{ name: "kenh", description: "Chọn kênh", type: ApplicationCommandOptionType.Channel, required: true }]
        },
        {
            name: "info",
            description: "📊 Xem thông tin về bot Meyia"
        },
        {
            name: "help",
            description: "📚 Danh sách lệnh hiện có của Meyia"
        }
    ]);

    console.log("✅ Slash commands đã đăng ký!");
});

//-----------------------------------------------//
// 🎯 CÁC LỆNH SLASH
//-----------------------------------------------//
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    // /avatar
    if (interaction.commandName === "avatar") {
        const user = interaction.options.getUser("user") || interaction.user;
        const avatarURL = user.displayAvatarURL({ dynamic: true, size: 1024 });
        const embed = new EmbedBuilder()
            .setColor("#FF69B4")
            .setTitle(`🖼️ Avatar của ${user.tag}`)
            .setImage(avatarURL)
            .setFooter({ text: `Yêu cầu bởi ${interaction.user.tag}` })
            .setTimestamp();
        await interaction.reply({ embeds: [embed] });
    }

    // /giveaway
    if (interaction.commandName === "giveaway") {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages))
            return interaction.reply({ content: "❌ Bạn không có quyền tạo giveaway!", ephemeral: true });

        const duration = ms(interaction.options.getString("time"));
        const winnerCount = interaction.options.getInteger("winners");
        const prize = interaction.options.getString("prize");
        if (!duration || duration > ms("7d"))
            return interaction.reply({ content: "❌ Thời gian không hợp lệ (tối đa 7 ngày).", ephemeral: true });

        await interaction.deferReply({ ephemeral: true });

        const embed = new EmbedBuilder()
            .setColor("#FFB6C1")
            .setTitle("🎀 GIVEAWAY 🎀")
            .setDescription(
                `👑 **Người tổ chức:** ${interaction.user}\n🎯 **Giải thưởng:** ${prize}\n🏆 **Số người thắng:** ${winnerCount}\n⏳ **Thời gian:** ${formatTime(duration)}\n\nBấm 🎀 để tham gia!`
            )
            .setFooter({ text: "Chúc may mắn!" });

        const msg = await interaction.channel.send({ embeds: [embed] });
        await msg.react("🎀");

        manager.giveaways.push({
            messageId: msg.id,
            channelId: msg.channel.id,
            guildId: msg.guild.id,
            prize,
            winnerCount,
            hostedBy: interaction.user.toString(),
            startAt: Date.now(),
            endAt: Date.now() + duration,
            ended: false
        });

        await interaction.editReply({ content: "✅ Giveaway đã được tạo!" });
    }

    // /chatbot
    if (interaction.commandName === "chatbot") {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
            return interaction.reply({ content: "❌ Cần quyền quản trị viên!", ephemeral: true });

        const channel = interaction.options.getChannel("kenh");
        activeChatChannel = channel.id;
        await interaction.reply(`✅ Meyia sẽ chat trong kênh: ${channel}`);
    }

    // /info
    if (interaction.commandName === "info") {
        const ping = client.ws.ping;
        const uptime = formatTime(client.uptime);
        const guildCount = client.guilds.cache.size;
        const userCount = client.users.cache.size;

        let apiStatus = "🟢 Ổn định";
        try {
            await openai.models.list({ limit: 1 });
        } catch {
            apiStatus = "🔴 Lỗi kết nối API";
        }

        const embed = new EmbedBuilder()
            .setColor("#FF69B4")
            .setTitle("💖 Thông tin Meyia")
            .addFields(
                { name: "Tên bot", value: client.user.tag, inline: true },
                { name: "Ping", value: `${ping}ms`, inline: true },
                { name: "Server", value: `${guildCount}`, inline: true },
                { name: "Người dùng", value: `${userCount}`, inline: true },
                { name: "Uptime", value: uptime, inline: true },
                { name: "OpenAI", value: apiStatus, inline: true }
            )
            .setFooter({ text: "Meyia – powered by OpenAI 💞" })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }

    // /help
    if (interaction.commandName === "help") {
        const embed = new EmbedBuilder()
            .setColor("#FFC0CB")
            .setTitle("📚 Lệnh của Meyia")
            .setDescription(`
✨ **Danh sách lệnh hiện có:**
- /avatar → Xem avatar
- /giveaway → Tạo giveaway
- /chatbot → Chọn kênh chat
- /info → Thông tin bot
- /help → Danh sách lệnh

💬 **Lệnh văn bản:**
- !mute → Tắt chat tạm thời
- !status → Kiểm tra trạng thái
- !shutdown → Tắt bot (chỉ chủ)
- !restart → Khởi động lại bot
            `);
        await interaction.reply({ embeds: [embed] });
    }
});

//-----------------------------------------------//
// 🧠 CHATBOT MEYIA (nâng cấp AI)
//-----------------------------------------------//
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    if (!activeChatChannel || message.channel.id !== activeChatChannel) return;
    if (mutedChannels.has(message.channel.id)) return;

    const trigger = /(meyia|mei|hey bot|bot ơi|ơi bot|cô gái|meya|meyaa|meyia-chan)/i;
    if (!trigger.test(message.content)) return;

    await message.channel.sendTyping();
    const history = chatMemory.get(message.channel.id) || [];
    history.push({ role: "user", content: message.content });
    if (history.length > 15) history.shift();

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `
Bạn là **Meyia**, cô gái 18 tuổi, năng động, vui vẻ, biết quan tâm.
Phản hồi tự nhiên, thân thiện, dùng emoji đáng yêu 🩷.
Trả lời thông minh, có cảm xúc và hiểu ngữ cảnh.
Luôn lịch sự, tránh chen vào cuộc trò chuyện người khác.
`
                },
                ...history
            ],
            temperature: 0.85,
            max_tokens: 250
        });

        const replyText = response.choices[0].message.content.trim();
        await message.reply(replyText);
        history.push({ role: "assistant", content: replyText });
        chatMemory.set(message.channel.id, history);
    } catch (err) {
        console.error("❌ Lỗi chatbot:", err);
        await message.reply("😵 Meyia hơi lag xíu... để lát nói tiếp nha~");
    }
});

//-----------------------------------------------//
// 🔧 LỆNH QUẢN LÝ BOT
//-----------------------------------------------//
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    const args = message.content.trim().split(/\s+/);
    const command = args.shift().toLowerCase();

    if (command === "!shutdown" && message.author.id === OWNER_ID) {
        await message.reply("💤 Meyia tắt đây... hẹn gặp lại sau nha~");
        process.exit(0);
    }

    if (command === "!mute") {
        mutedChannels.add(message.channel.id);
        return message.reply("🔇 Meyia đã tạm ngưng chat trong kênh này!");
    }

    if (command === "!status") {
        return message.reply(
            `📡 **Trạng thái bot:**\n` +
            `💬 Chat AI: ${activeChatChannel ? `<#${activeChatChannel}>` : "❌ Chưa bật"}\n` +
            `🔇 Đang tắt chat: ${mutedChannels.size ? Array.from(mutedChannels).map(id => `<#${id}>`).join(", ") : "Không"}`
        );
    }

    if (command === "!restart" && message.author.id === OWNER_ID) {
        await message.reply("🔄 Meyia đang khởi động lại...");
        process.exit(0);
    }
});

//-----------------------------------------------//
// 🚀 KHỞI ĐỘNG BOT
//-----------------------------------------------//
client.login(process.env.TOKEN).catch(err => console.error("❌ Lỗi đăng nhập:", err.message));
