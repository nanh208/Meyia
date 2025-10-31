// index.js — Meyia v1.4.0 (Final Hybrid Premium Edition)
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const os = require("os");
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

// ----------- CONFIG & LOGS -----------
const activityPath = path.join(__dirname, "config", "activity.json");
if (!fs.existsSync(path.dirname(activityPath))) fs.mkdirSync(path.dirname(activityPath), { recursive: true });
if (!fs.existsSync(activityPath)) fs.writeFileSync(activityPath, "{}");
let activityConfig = JSON.parse(fs.readFileSync(activityPath, "utf8"));
function saveActivityConfig() {
  fs.writeFileSync(activityPath, JSON.stringify(activityConfig, null, 2));
}
function logActivity(guildId, msg) {
  const cfg = activityConfig[guildId];
  if (!cfg || !cfg.enabled || !cfg.channelId) return;
  const ch = client.channels.cache.get(cfg.channelId);
  if (ch) ch.send(msg).catch(() => {});
}

// ----------- CLIENT INIT -----------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions
  ]
});

const OWNER_ID = process.env.OWNER_ID || "1409222785154416651";
let mutedChannels = new Set();
const cooldowns = new Map();

function hasAdminPermission(i) {
  if (!i) return false;
  if (i.member)
    return i.member.permissions?.has(PermissionFlagsBits.Administrator) ||
      i.user?.id === OWNER_ID ||
      i.member.permissions?.has(PermissionFlagsBits.ManageGuild);
  if (i.permissions)
    return i.permissions.has(PermissionFlagsBits.Administrator) ||
      i.user?.id === OWNER_ID ||
      i.permissions.has(PermissionFlagsBits.ManageGuild);
  return false;
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d ? `${d}d ` : ""}${h ? `${h}h ` : ""}${m}m`;
}

// ----------- GIVEAWAY MANAGER -----------
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

// ----------- READY EVENT -----------
client.once(Events.ClientReady, async () => {
  console.log(`✅ Bot MEYIA đã sẵn sàng (${client.user.tag})`);

  await client.application.commands.set([
    { name: "help", description: "Xem các lệnh của bot" },
    { name: "status", description: "Xem trạng thái bot" },
    {
      name: "giveaway",
      description: "Tạo giveaway 🎉",
      options: [
        { name: "time", description: "Thời gian (vd: 1m, 1h, 1d)", type: ApplicationCommandOptionType.String, required: true },
        { name: "winners", description: "Số người thắng", type: ApplicationCommandOptionType.Integer, required: true },
        { name: "prize", description: "Phần thưởng", type: ApplicationCommandOptionType.String, required: true }
      ]
    },
    { name: "avatar", description: "Xem avatar", options: [{ name: "user", description: "Người cần xem", type: ApplicationCommandOptionType.User, required: false }] },
    { name: "info", description: "Thông tin bot" },
    { name: "ping", description: "Kiểm tra độ trễ" },
    { name: "quote", description: "Trích dẫn ngẫu nhiên" },
    { name: "mood", description: "Tâm trạng của Meyia 💖" },
    { name: "say", description: "Bot nói lại", options: [{ name: "text", description: "Nội dung", type: ApplicationCommandOptionType.String, required: true }] }
  ]);

  console.log("✅ Slash commands đã đăng ký.");
});

// ----------- INTERACTIONS -----------
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const cmd = interaction.commandName;
  const userId = interaction.user.id;
  if (!cooldowns.has(userId)) cooldowns.set(userId, 0);
  const now = Date.now();
  if (now - cooldowns.get(userId) < 3000) return interaction.reply({ content: "⏳ Hãy chờ vài giây trước khi dùng lại lệnh!", ephemeral: true });
  cooldowns.set(userId, now);

  // ===== 🎁 GIVEAWAY (GIỮ NGUYÊN FORM) =====
  if (cmd === "giveaway") {
    const prize = interaction.options.getString("prize");
    const duration = ms(interaction.options.getString("time"));
    const winnerCount = interaction.options.getInteger("winners");
    const host = interaction.user;
    const channel = interaction.channel;
    if (!duration) return interaction.reply({ content: "⚠️ Thời gian không hợp lệ! (vd: 1m, 1h, 1d)", ephemeral: true });

    const endTime = Date.now() + duration;
    const giveawayId = Math.floor(Math.random() * 999999999);
    const embed = new EmbedBuilder()
      .setColor("#ca50dcff")
      .setTitle(`<a:1255341894687260775:1433317867293642858> G I V E A W A Y <a:1255341894687260775:1433317867293642858>`)
      .setDescription(
        `🎁 **Phần thưởng:** ${prize}\n\n` +
        `<a:1255340646248616061:1433317989406605383> Nhấn emoji bên dưới để tham gia!\n\n` +
        `👑 **Tổ chức bởi:** ${host}\n` +
        `🏆 **Số lượng giải:** ${winnerCount}\n` +
        `⏰ **Kết thúc:** <t:${Math.floor(endTime / 1000)}:R>`
      )
      .setThumbnail(host.displayAvatarURL({ dynamic: true }))
      .setImage(interaction.client.user.displayAvatarURL({ dynamic: true, size: 512 }))
      .setFooter({ text: `📛 Mã giveaway: ${giveawayId}` });

    const msg = await channel.send({ embeds: [embed] });
    await msg.react("<a:1261960933270618192:1433286685189341204>");
    const participants = new Set();

    const collector = msg.createReactionCollector({
      filter: (r, u) => r.emoji.identifier === "1261960933270618192:1433286685189341204" && !u.bot,
      time: duration
    });

    collector.on("collect", (_, user) => participants.add(user.id));
    collector.on("end", async () => {
      let winners = [];
      if (participants.size > 0) {
        const all = Array.from(participants);
        for (let i = 0; i < winnerCount && all.length > 0; i++) {
          winners.push(all.splice(Math.floor(Math.random() * all.length), 1)[0]);
        }
      }
      const winnerText = winners.length ? `🏆 **Người chiến thắng:** ${winners.map(id => `<@${id}>`).join(", ")}` : "❌ Không có ai tham gia giveaway này!";
      const endEmbed = new EmbedBuilder()
        .setColor("#ea4ce7ff")
        .setTitle(`<a:1255341894687260775:1433317867293642858> GIVEAWAY ĐÃ KẾT THÚC <a:1255340646248616061:1433317989406605383>`)
        .setDescription(`🎁 **Phần thưởng:** ${prize}\n\n${winnerText}\n\n👑 **Người tổ chức:** ${host}\n📛 **Mã giveaway:** ${giveawayId}`)
        .setThumbnail(host.displayAvatarURL({ dynamic: true }))
        .setImage(interaction.client.user.displayAvatarURL({ dynamic: true, size: 512 }));
      await msg.edit({ embeds: [endEmbed] });
      if (winners.length > 0) await channel.send(`🎊 Chúc mừng ${winners.map(id => `<@${id}>`).join(", ")} đã thắng **${prize}**!`);
    });

    return interaction.reply({ content: "✅ Giveaway đã được tạo thành công!", ephemeral: true });
  }

  // ===== ⚙️ TIỆN ÍCH =====
  if (cmd === "ping") {
    const ping = client.ws.ping;
    const uptime = formatUptime(process.uptime());
    const embed = new EmbedBuilder()
      .setColor("#DB7093")
      .setTitle("🏓 Pong! Kết quả kiểm tra:")
      .setDescription(`🌸 **API:** ${ping}ms\n💖 **Uptime:** ${uptime}`)
      .setFooter({ text: "Meyia luôn hoạt động hết mình 💕" });
    return interaction.reply({ embeds: [embed] });
  }

  if (cmd === "info") {
    const mem = (os.totalmem() - os.freemem()) / 1024 / 1024;
    const embed = new EmbedBuilder()
      .setColor("#DB7093")
      .setTitle("🌸 Meyia v1.4.0 — All-in-one Bot")
      .setDescription("Một cô trợ lý nhỏ xinh giúp bạn quản lý & tạo niềm vui 💕")
      .addFields(
        { name: "👑 Người phát triển", value: `<@${OWNER_ID}>`, inline: true },
        { name: "⚙️ Phiên bản", value: "v1.4.0", inline: true },
        { name: "💾 RAM sử dụng", value: `${mem.toFixed(2)} MB`, inline: true },
        { name: "🩷 Framework", value: "discord.js v14", inline: true },
        { name: "🌐 Server đang phục vụ", value: `${client.guilds.cache.size}`, inline: true }
      )
      .setThumbnail(client.user.displayAvatarURL())
      .setFooter({ text: "💫 Meyia Bot © 2025" });
    return interaction.reply({ embeds: [embed] });
  }

  if (cmd === "quote") {
    const quotes = [
      "🌸 Mỗi ngày là một cơ hội mới để tỏa sáng.",
      "💫 Đừng sợ thất bại, vì nó dạy bạn cách thành công.",
      "🌷 Nụ cười là vũ khí mạnh nhất của bạn.",
      "💖 Hãy yêu bản thân mình trước khi yêu ai khác.",
      "🌈 Sống là để yêu thương và được yêu thương."
    ];
    const quote = quotes[Math.floor(Math.random() * quotes.length)];
    const embed = new EmbedBuilder()
      .setColor("#DB7093")
      .setTitle("✨ Trích dẫn ngẫu nhiên")
      .setDescription(quote)
      .setFooter({ text: "Meyia nói lời dễ thương 💕" });
    return interaction.reply({ embeds: [embed] });
  }

  if (cmd === "mood") {
    const moods = ["😊 Vui vẻ", "🥰 Hạnh phúc", "😴 Mệt mỏi", "🤔 Suy tư", "😎 Tự tin"];
    const mood = moods[Math.floor(Math.random() * moods.length)];
    const embed = new EmbedBuilder()
      .setColor("#DB7093")
      .setTitle("💖 Tâm trạng hiện tại của Meyia")
      .setDescription(`Hôm nay mình cảm thấy **${mood}** đó~ ✨`);
    return interaction.reply({ embeds: [embed] });
  }

  if (cmd === "say") {
    const text = interaction.options.getString("text");
    await interaction.channel.send({ content: text });
    return interaction.reply({ content: "💬 Đã gửi tin nhắn!", ephemeral: true });
  }

  if (cmd === "avatar") {
    const user = interaction.options.getUser("user") || interaction.user;
    const embed = new EmbedBuilder()
      .setColor("#DB7093")
      .setTitle(`🖼️ Avatar của ${user.tag}`)
      .setImage(user.displayAvatarURL({ dynamic: true, size: 1024 }))
      .setFooter({ text: "💖 Ấn vào avatar để tải ảnh full size" });
    return interaction.reply({ embeds: [embed] });
  }
});

// ----------- LOGIN -----------
const token = process.env.TOKEN || process.env.DISCORD_TOKEN;
if (!token) console.error("❌ Thiếu TOKEN trong .env");
else client.login(token);
