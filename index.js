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
let activeCuteChannel = null;
let mutedChannels = new Set();
const chatMemory = new Map();
const cuteMemory = new Map();

//-----------------------------------------------//
// ⏰ HÀM CHUYỂN THỜI GIAN
//-----------------------------------------------//
function formatTime(ms) {
    if (ms <= 0) return "0 giây";
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / 1000 / 60) % 60);
    const hours = Math.floor((ms / 1000 / 60 / 60) % 24);
    const days = Math.floor(ms / 1000 / 60 / 60 / 24);
    const parts = [];
    if (days > 0) parts.push(`${days} ngày`);
    if (hours > 0) parts.push(`${hours} giờ`);
    if (minutes > 0) parts.push(`${minutes} phút`);
    if (seconds > 0) parts.push(`${seconds} giây`);
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
        reaction: "<a:1261960933270618192:1433286685189341204>",
        winnerCount: 1
    }
});
client.giveawaysManager = manager;

//-----------------------------------------------//
// 🚀 KHỞI ĐỘNG BOT
//-----------------------------------------------//
client.once(Events.ClientReady, async (readyClient) => {
    console.log(`✅ Bot MEYIA đã sẵn sàng (${readyClient.user.tag})`);

    await client.application.commands.set([
        {
            name: "help",
            description: "Xem tất cả các lệnh của Meyia"
        },
        {
            name: "status",
            description: "Xem trạng thái hiện tại của bot"
        },
        {
            name: "giveaway",
            description: "Tạo giveaway mới",
            options: [
                { name: "time", description: "Thời gian (vd: 1m, 1h, 1d)", type: ApplicationCommandOptionType.String, required: true },
                { name: "winners", description: "Số người thắng", type: ApplicationCommandOptionType.Integer, required: true },
                { name: "prize", description: "Phần thưởng", type: ApplicationCommandOptionType.String, required: true }
            ]
        },
        {
            name: "avatar",
            description: "Xem avatar của ai đó hoặc chính bạn",
            options: [{ name: "user", description: "Người dùng cần xem", type: ApplicationCommandOptionType.User, required: false }]
        },
        {
            name: "chatbot",
            description: "Thiết lập kênh chat cho Meyia",
            options: [{ name: "kenh", description: "Chọn kênh bot sẽ chat", type: ApplicationCommandOptionType.Channel, required: true }]
        },
        {
            name: "botcute",
            description: "Thiết lập kênh trò chuyện đáng yêu riêng biệt cho Meyia",
            options: [{ name: "kenh", description: "Chọn kênh botcute sẽ chat", type: ApplicationCommandOptionType.Channel, required: true }]
        },
        {
            name: "info",
            description: "Xem thông tin chi tiết về bot Meyia"
        }
    ]);

    console.log("✅ Slash commands đã đăng ký!");
});

//-----------------------------------------------//
// 🎯 LỆNH SLASH COMMANDS
//-----------------------------------------------//
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    // 🔰 HELP
    if (interaction.commandName === "help") {
        const embed = new EmbedBuilder()
            .setColor("#FFC0CB")
            .setTitle("📜 Lệnh của Meyia")
            .setDescription(`
**🎀 Giveaway**
\`/giveaway\` – Tạo giveaway mới  

**💬 Chatbot**
\`/chatbot\` – Thiết lập kênh để Meyia trò chuyện  
\`/botcute\` – Kênh trò chuyện đáng yêu riêng biệt  
\`!mute\` – Tạm dừng chat của Meyia trong kênh  

**🖼️ Tiện ích**
\`/avatar\` – Xem avatar của ai đó  
\`/info\` – Xem thông tin về bot  
\`/status\` – Kiểm tra trạng thái bot  
\`!shutdown\` – Tắt bot  
\`!restart\` – Khởi động lại bot  

> 💡 Gọi Meyia bằng cách nhắc tên hoặc nói “này Meyia”, “ê bot”, “Meyia ơi”, “bé ơi”, “em bot ơi”, “chị ơi”, “gái ơi”,...
`)
            .setFooter({ text: "Meyia — đáng yêu và luôn lắng nghe 💖" });
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // 🔧 STATUS
    if (interaction.commandName === "status") {
        return interaction.reply({
            content:
                `📡 **Trạng thái bot:**\n` +
                `🧠 Chat AI: ${activeChatChannel ? `<#${activeChatChannel}>` : "❌ Chưa bật"}\n` +
                `💖 BotCute: ${activeCuteChannel ? `<#${activeCuteChannel}>` : "❌ Chưa bật"}\n` +
                `🔇 Đang tắt chat: ${mutedChannels.size > 0 ? Array.from(mutedChannels).map(id => `<#${id}>`).join(", ") : "Không"}`
        });
    }

    // 🖼️ AVATAR
    if (interaction.commandName === "avatar") {
        const user = interaction.options.getUser("user") || interaction.user;
        const avatarURL = user.displayAvatarURL({ dynamic: true, size: 1024 });
        const embed = new EmbedBuilder()
            .setColor("#FF69B4")
            .setTitle(`🖼️ Avatar của ${user.tag}`)
            .setImage(avatarURL)
            .setFooter({ text: `Yêu cầu bởi ${interaction.user.tag}` })
            .setTimestamp();
        return interaction.reply({ embeds: [embed] });
    }

    // 🎀 GIVEAWAY GIỮ NGUYÊN ICON
    if (interaction.commandName === "giveaway") {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages))
            return interaction.reply({ content: "❌ Bạn không có quyền tạo giveaway!", ephemeral: true });

        const duration = ms(interaction.options.getString("time"));
        const winnerCount = interaction.options.getInteger("winners");
        const prize = interaction.options.getString("prize");
        if (!duration || duration > ms("7d"))
            return interaction.reply({ content: "❌ Thời gian không hợp lệ (tối đa 7 ngày).", ephemeral: true });

        await interaction.deferReply({ ephemeral: true });
        const code = Math.floor(1000000000 + Math.random() * 9000000000).toString();
        const endTime = Date.now() + duration;

        const embed = new EmbedBuilder()
            .setColor("#FFB6C1")
            .setTitle("<a:1255341894687260775:1433317867293642858> 🎀 ＧＩＶＥＡＷＡＹ 🎀 <a:1255341894687260775:1433317867293642858>")
            .setDescription(
                `👑 **Người tổ chức:** ${interaction.user}\n` +
                `<a:12553406462486160061:1433317989406605383> Bấm emoji <a:1261960933270618192:1433286685189341204> để tham gia!\n` +
                `🎯 **Số lượng giải:** ${winnerCount}\n` +
                `⏳ **Còn lại:** ${formatTime(duration)}\n\n` +
                `🎁 **Phần thưởng:** ${prize}`
            )
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
            .setImage(interaction.client.user.displayAvatarURL({ size: 512 }))
            .setFooter({ text: `🎟️ Mã giveaway: ${code}` });

        const msg = await interaction.channel.send({ embeds: [embed] });
        await msg.react("<a:1261960933270618192:1433286685189341204>");

        const countdown = setInterval(async () => {
            const remaining = endTime - Date.now();
            if (remaining <= 0) clearInterval(countdown);
        }, 10_000);

        await interaction.editReply({ content: `✅ Giveaway đã được tạo!\n💌 Mã: **${code}**` });
    }

    // 💬 CHATBOT
    if (interaction.commandName === "chatbot") {
        const channel = interaction.options.getChannel("kenh");
        activeChatChannel = channel.id;
        return interaction.reply(`✅ Meyia sẽ trò chuyện trong kênh: ${channel}`);
    }

    // 💖 BOTCUTE
    if (interaction.commandName === "botcute") {
        const channel = interaction.options.getChannel("kenh");
        activeCuteChannel = channel.id;
        return interaction.reply(`💖 Meyia Cute sẽ trò chuyện trong kênh: ${channel}`);
    }

    // 🪞 INFO
    if (interaction.commandName === "info") {
        const embed = new EmbedBuilder()
            .setColor("#FFB6C1")
            .setTitle("💫 Thông tin về Meyia")
            .setDescription(`
🌸 **Tên:** Meyia  
🎀 **Phiên bản:** 1.2.0  
🧠 **AI Model:** GPT-4o-mini  
💖 **Nhà phát triển:** <@1409222785154416651>  
📆 **Ngày tạo:** 2025  
✨ **Tính cách:** Dễ thương, vui vẻ, thích pha trò và luôn sẵn sàng giúp đỡ!  
`)
            .setThumbnail(client.user.displayAvatarURL())
            .setFooter({ text: "Meyia — người bạn nhỏ đáng yêu của bạn 💕" });
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
});

//-----------------------------------------------//
// 🧠 CHATBOT MEYIA + BOTCUTE
//-----------------------------------------------//
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    // --- CHATBOT CHÍNH ---
    if (activeChatChannel && message.channel.id === activeChatChannel && !mutedChannels.has(message.channel.id)) {
        const trigger = /(meyia|bot|em ơi|bé ơi|gái ơi|chị ơi|này meyia|ê bot|cô ơi)/i;
        if (!trigger.test(message.content)) return;

        if (Math.random() < 0.3) return;
        await message.channel.sendTyping();

        const history = chatMemory.get(message.channel.id) || [];
        history.push({ role: "user", content: message.content });
        if (history.length > 10) history.shift();

        try {
            const response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: `Bạn là Meyia, cô gái 18 tuổi vui vẻ, tinh nghịch, hiểu cảm xúc người khác, nói chuyện tự nhiên, thân thiện.`
                    },
                    ...history
                ],
                temperature: 0.85,
                max_tokens: 220
            });

            const replyText = response.choices[0].message.content.trim();
            await message.reply(replyText);
            history.push({ role: "assistant", content: replyText });
            chatMemory.set(message.channel.id, history);
        } catch {
            await message.reply("🥺 Em bị lag xíu, nói lại cho Meyia nha~");
        }
    }

    // --- BOTCUTE ---
    if (activeCuteChannel && message.channel.id === activeCuteChannel && !mutedChannels.has(message.channel.id)) {
        await message.channel.sendTyping();

        const history = cuteMemory.get(message.channel.id) || [];
        history.push({ role: "user", content: message.content });
        if (history.length > 10) history.shift();

        try {
            const response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: `Bạn là Meyia Cute, cực kỳ đáng yêu, nói chuyện như bé con, thích emoji 💕, nói ngắn gọn, ngọt ngào và thân mật.`
                    },
                    ...history
                ],
                temperature: 0.9,
                max_tokens: 120
            });

            const replyText = response.choices[0].message.content.trim();
            await message.reply(replyText);
            history.push({ role: "assistant", content: replyText });
            cuteMemory.set(message.channel.id, history);
        } catch {
            await message.reply("🌸 Huhu Meyia Cute hơi lag xíu, đợi em nha~");
        }
    }
});

//-----------------------------------------------//
// 🔧 LỆNH QUẢN LÝ
//-----------------------------------------------//
client.on(Events.MessageCreate, async (msg) => {
    if (msg.author.bot) return;
    const args = msg.content.trim().split(/\s+/);
    const cmd = args.shift().toLowerCase();

    if (cmd === "!shutdown" && msg.author.id === OWNER_ID) {
        await msg.reply("💤 Meyia tắt đây... hẹn gặp lại sau nha~");
        process.exit(0);
    }
    if (cmd === "!restart" && msg.author.id === OWNER_ID) {
        await msg.reply("🔄 Meyia đang khởi động lại...");
        process.exit(0);
    }
    if (cmd === "!mute") {
        mutedChannels.add(msg.channel.id);
        return msg.reply("🔇 Meyia đã tạm ngưng chat trong kênh này!");
    }
    if (cmd === "!status") {
        return msg.reply(
            `📡 **Trạng thái bot:**\n` +
            `🧠 Chat AI: ${activeChatChannel ? `<#${activeChatChannel}>` : "❌ Chưa bật"}\n` +
            `💖 BotCute: ${activeCuteChannel ? `<#${activeCuteChannel}>` : "❌ Chưa bật"}\n` +
            `🔇 Đang tắt chat: ${mutedChannels.size ? Array.from(mutedChannels).map(id => `<#${id}>`).join(", ") : "Không"}`
        );
    }
});

client.login(process.env.TOKEN).catch(err => console.error("❌ Lỗi đăng nhập:", err.message));
