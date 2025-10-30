const {
    Client,
    Events,
    GatewayIntentBits,
    ApplicationCommandOptionType,
    EmbedBuilder,
    PermissionFlagsBits
} = require("discord.js");
const { GiveawaysManager } = require("discord-giveaways");
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
    console.log(`✅ Bot đã sẵn sàng (${readyClient.user.tag})`);

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
        }
    ]);

    console.log("✅ Slash commands đã đăng ký!");
});

//-----------------------------------------------//
// 🎉 GIVEAWAY COMMAND
//-----------------------------------------------//
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    // 🔹 LỆNH /AVATAR
if (interaction.commandName === "avatar") {
    try {
        const user = interaction.options.getUser("user") || interaction.user;

        const avatarURL = user.displayAvatarURL({ dynamic: true, size: 1024 });
        if (!avatarURL) return interaction.reply({ content: "❌ Không thể lấy avatar!", ephemeral: true });

        const embed = new EmbedBuilder()
            .setColor("#FF69B4")
            .setTitle(`🖼️ Avatar của ${user.tag}`)
            .setImage(avatarURL)
            .setFooter({ text: `Yêu cầu bởi ${interaction.user.tag}` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    } catch (err) {
        console.error("⚠️ Lỗi /avatar:", err);
        await interaction.reply({ content: "❌ Đã xảy ra lỗi khi hiển thị avatar.", ephemeral: true });
    }
}

    // 🔹 LỆNH /GIVEAWAY
    if (interaction.commandName === "giveaway") {
        const ms = require("ms");

        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages))
            return interaction.reply({ content: "❌ Bạn không có quyền tạo giveaway!", ephemeral: true });

        const duration = ms(interaction.options.getString("time"));
        const winnerCount = interaction.options.getInteger("winners");
        const prize = interaction.options.getString("prize");

        if (!duration || duration > ms("7d"))
            return interaction.reply({ content: "❌ Thời gian không hợp lệ (tối đa 7 ngày).", ephemeral: true });

        await interaction.deferReply({ ephemeral: true });

        // 🔢 Mã giveaway
        const code = Math.floor(1000000000 + Math.random() * 9000000000).toString();

        // 🧱 Embed tùy chỉnh
        const embed = new EmbedBuilder()
            .setColor("#FFB6C1")
            .setTitle("<a:1255341894687260775:1433317867293642858>  ＧＩＶＥＡＷＡＹ  <a:1255341894687260775:1433317867293642858>")
            .setDescription(
                `👑 **Người tổ chức:** ${interaction.user}\n` +
                `<a:12553406462486160061:1433317989406605383>Mọi người bấm vào emoji <a:1261960933270618192:1433286685189341204> để tham gia\n` +
                `<a:12553406462486160061:1433317989406605383>Số lượng giải: **${winnerCount}**\n` +
                `⏳ Thời gian còn lại: **${formatTime(duration)}**\n\n` +
                `🎁 **Phần thưởng:** ${prize}`
            )
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
            .setImage(interaction.client.user.displayAvatarURL({ size: 512 }))
            .setFooter({ text: `Mã giveaway: ${code}` });

        // 📤 Gửi message
        const msg = await interaction.channel.send({ embeds: [embed] });
        await msg.react("<a:1261960933270618192:1433286685189341204>");

        // 🪄 Ghi giveaway không tạo embed phụ
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
            messages: {} // ❗ Không cho tạo embed mặc định
        });
        await manager.saveGiveaway(msg.id, manager.giveaways[manager.giveaways.length - 1]);

        // 💌 DM mã
        try {
            await interaction.user.send(
                `🎟️ **MÃ GIVEAWAY CỦA BẠN:** \`${code}\`\n📦 Phần thưởng: ${prize}\n🕒 Thời gian: ${formatTime(duration)}`
            );
        } catch {}

        await interaction.editReply({
            content: `✅ Giveaway đã được tạo!\n💌 Mã: **${code}**`
        });
    }
});

//-----------------------------------------------//
// 🔁 LỆNH KHỞI ĐỘNG LẠI
//-----------------------------------------------//
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    if (message.content === "!restart" && message.author.id === "1409222785154416651") {
        await message.reply("🔄 Bot đang khởi động lại...");
        process.exit(0);
    }
});

client.login(process.env.TOKEN).catch(err => console.error("❌ Lỗi đăng nhập:", err.message));
