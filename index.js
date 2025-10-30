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
// 🚀 READY + LỆNH
//-----------------------------------------------//
client.once(Events.ClientReady, async (readyClient) => {
    console.log(`✅ Bot MEYIA đã sẵn sàng (${readyClient.user.tag})`);

    await client.application.commands.set([
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
            options: [
                { name: "user", description: "Người dùng cần xem", type: ApplicationCommandOptionType.User, required: false }
            ]
        },
        {
            name: "chatbot",
            description: "Thiết lập kênh chat cho Meyia",
            options: [
                {
                    name: "kenh",
                    description: "Chọn kênh bot sẽ chat",
                    type: ApplicationCommandOptionType.Channel,
                    required: true
                }
            ]
        }
    ]);

    console.log("✅ Slash commands đã đăng ký!");
});

//-----------------------------------------------//
// 🎉 GIVEAWAY COMMAND
//-----------------------------------------------//
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    // 🔹 /AVATAR
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

    // 🔹 /GIVEAWAY
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

        const embed = new EmbedBuilder()
            .setColor("#FFB6C1")
            .setTitle("<a:1255341894687260775:1433317867293642858> 🎀 ＧＩＶＥＡＷＡＹ 🎀 <a:1255341894687260775:1433317867293642858>")
            .setDescription(
                `👑 **Người tổ chức:** ${interaction.user}\n` +
                `<a:12553406462486160061:1433317989406605383> Bấm emoji <a:1261960933270618192:1433286685189341204> để tham gia!\n` +
                `🎯 **Số lượng giải:** ${winnerCount}\n` +
                `⏳ **Thời gian còn lại:** ${formatTime(duration)}\n\n` +
                `🎁 **Phần thưởng:** ${prize}`
            )
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
            .setImage(interaction.client.user.displayAvatarURL({ size: 512 }))
            .setFooter({ text: `🎟️ Mã giveaway: ${code}` });

        const msg = await interaction.channel.send({ embeds: [embed] });
        await msg.react("<a:1261960933270618192:1433286685189341204>");

        manager.giveaways.push({
            messageId: msg.id,
            channelId: msg.channel.id,
            guildId: msg.guild.id,
            prize,
            winnerCount,
            hostedBy: interaction.user.toString(),
            startAt: Date.now(),
            endAt: Date.now() + duration,
            ended: false,
            data: { code, ownerId: interaction.user.id },
            messages: {}
        });
        await manager.saveGiveaway(msg.id, manager.giveaways[manager.giveaways.length - 1]);

        try {
            await interaction.user.send(`🎟️ **MÃ GIVEAWAY:** \`${code}\`\n📦 Phần thưởng: ${prize}\n🕒 Thời gian: ${formatTime(duration)}`);
        } catch {}

        await interaction.editReply({ content: `✅ Giveaway đã được tạo!\n💌 Mã: **${code}**` });
    }

    // 🔹 /CHATBOT
    if (interaction.commandName === "chatbot") {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
            return interaction.reply({ content: "❌ Bạn cần quyền Quản trị viên để thiết lập chatbot!", ephemeral: true });

        const channel = interaction.options.getChannel("kenh");
        activeChatChannel = channel.id;

        await interaction.reply(`✅ Meyia sẽ chỉ trò chuyện trong kênh: ${channel}`);
    }
});

//-----------------------------------------------//
// ⚙️ LỆNH TÙY CHỈNH GIVEAWAY
//-----------------------------------------------//
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    // 🔹 Khi bot bị tag → thả icon
    if (message.mentions.has(client.user)) {
        return message.react("<a:12553406462486160061:1433317989406605383>");
    }

    const args = message.content.trim().split(/\s+/);
    const command = args.shift().toLowerCase();

    // STOP
    if (command === "!stop") {
        const code = args[0];
        if (!code) return message.reply("❌ Nhập mã giveaway để dừng!");
        const gw = manager.giveaways.find(g => g.data?.code === code);
        if (!gw) return message.reply("⚠️ Không tìm thấy giveaway!");
        manager.end(gw.messageId);
        return message.reply("🛑 Giveaway đã dừng!");
    }

    // RANDOM
    if (command === "!random") {
        const code = args[0];
        if (!code) return message.reply("❌ Nhập mã giveaway!");
        const gw = manager.giveaways.find(g => g.data?.code === code);
        if (!gw) return message.reply("⚠️ Không tìm thấy giveaway!");
        const winners = await manager.roll(gw);
        return message.reply(`🎉 Người thắng mới: ${winners.map(u => u.toString()).join(", ")}`);
    }

    // FIX
    if (command === "!fix") {
        const code = args[0];
        if (!code) return message.reply("❌ Nhập mã giveaway!");
        const gw = manager.giveaways.find(g => g.data?.code === code);
        if (!gw) return message.reply("⚠️ Không tìm thấy giveaway!");

        gw.prize += " (ĐÃ CHỈNH)";
        await manager.saveGiveaway(gw.messageId, gw);
        return message.reply("🛠️ Giveaway đã được cập nhật!");
    }
});

//-----------------------------------------------//
// 💬 CHATBOT MEYIA
//-----------------------------------------------//
let activeChatChannel = null;
const chatMemory = new Map();

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    if (!activeChatChannel || message.channel.id !== activeChatChannel) return;

    const content = message.content.toLowerCase();
    const casualTriggers = ["hi", "chào", "hello", "bot ơi", "ê bot", "haha", "kkk", "cười", "lmao"];
    const meyiaTriggers = ["meyia", "meyia ơi", "hi meyia", "ê meyia", "meyia đâu"];

    // CẤP 2: Chat nhẹ
    if (casualTriggers.some(t => content.includes(t)) || meyiaTriggers.some(t => content.includes(t))) {
        const replies = [
            "🌸 Meyia đây nè~ ai gọi đó vậy 😝",
            "💖 Gọi tui ngọt dữ zạ~ hihi",
            "😳 Gọi gì mà nhỏ nhẹ vậy, nghe mắc cỡ ghê~",
            "✨ Ủa ai nhớ tui đó hở?",
            "🥰 Meyia xuất hiện rồiii, có chuyện gì hong nè?"
        ];
        return message.reply(replies[Math.floor(Math.random() * replies.length)]);
    }

    // CẤP 3 + 4: GPT trò chuyện
    try {
        await message.channel.sendTyping();

        const history = chatMemory.get(message.channel.id) || [];
        history.push({ role: "user", content: message.content });
        if (history.length > 8) history.shift();

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `
Bạn là **Meyia**, một cô gái 18 tuổi dễ thương, năng động, thân thiện.
Tính cách:
- Hài hước, gần gũi, vui vẻ, hay dùng emoji (🥰✨😳💖🌸😝).
- Thích nói chuyện kiểu tự nhiên, đôi khi nhây nhẹ hoặc trêu người dùng cho vui.
- Khi ai gọi “Meyia” thì phản ứng đáng yêu, hơi ngại nhưng vui.
- Không cứng nhắc, nói chuyện như người thật.
- Tránh các chủ đề chính trị, tôn giáo, nhạy cảm.
`
                },
                ...history
            ],
            temperature: 0.9,
            max_tokens: 220
        });

        const replyText = response.choices[0].message.content;
        await message.reply(replyText);

        history.push({ role: "assistant", content: replyText });
        chatMemory.set(message.channel.id, history);
    } catch (err) {
        console.error("❌ Lỗi chat:", err);
        message.reply("😵 Meyia hơi mệt xíu... để lát nói tiếp nha~");
    }
});

//-----------------------------------------------//
// 🔁 KHỞI ĐỘNG LẠI
//-----------------------------------------------//
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    if (message.content === "!restart" && message.author.id === "1409222785154416651") {
        await message.reply("🔄 Meyia đang khởi động lại...");
        process.exit(0);
    }
});

client.login(process.env.TOKEN).catch(err => console.error("❌ Lỗi đăng nhập:", err.message));
