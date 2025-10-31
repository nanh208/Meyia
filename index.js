// index.js — Meyia all-in-one (v1.5.0 Full Enhanced)
require("dotenv").config();
const fs = require("fs");
const path = require("path");
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

// -------- CONFIG -------- //
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

// -------- CLIENT INIT -------- //
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
const MAIN_COLOR = "#CA50DC";
let mutedChannels = new Set();

function hasAdminPermission(i) {
  return (
    i?.member?.permissions?.has(PermissionFlagsBits.Administrator) ||
    i?.user?.id === OWNER_ID ||
    i?.member?.permissions?.has(PermissionFlagsBits.ManageGuild)
  );
}

function getStatusString() {
  return `📡 **Trạng thái bot:**\n🧠 Chat AI: 🔒 Tắt\n🔇 Kênh mute: ${
    mutedChannels.size
      ? Array.from(mutedChannels)
          .map(id => `<#${id}>`)
          .join(", ")
      : "Không"
  }`;
}

// -------- GIVEAWAY MANAGER -------- //
const manager = new GiveawaysManager(client, {
  storage: "./giveaways.json",
  default: {
    botsCanWin: false,
    embedColor: MAIN_COLOR,
    embedColorEnd: "#000000",
    reaction: "<a:1261960933270618192:1433286685189341204>",
    winnerCount: 1
  }
});
client.giveawaysManager = manager;

// -------- READY -------- //
client.once(Events.ClientReady, async () => {
  console.log(`✅ Bot MEYIA đã sẵn sàng (${client.user.tag})`);

  await client.application.commands.set([
    { name: "help", description: "Xem danh sách lệnh của bot" },
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
    {
      name: "activity",
      description: "Quản lý log hoạt động (chỉ admin)",
      options: [
        { name: "setup", description: "Chọn kênh log", type: 1, options: [{ name: "channel", description: "Kênh log", type: ApplicationCommandOptionType.Channel, required: true }] },
        { name: "enable", description: "Bật log hoạt động", type: 1 },
        { name: "disable", description: "Tắt log hoạt động", type: 1 }
      ]
    },
    { name: "avatar", description: "Xem avatar", options: [{ name: "user", description: "Người cần xem", type: ApplicationCommandOptionType.User, required: false }] },
    { name: "info", description: "Thông tin bot" },
    { name: "xoachat", description: "Xóa tin nhắn (admin)", options: [{ name: "count", description: "Số tin nhắn (1-99)", type: ApplicationCommandOptionType.Integer, required: true }] },
    { name: "ping", description: "Kiểm tra độ trễ" },
    { name: "8ball", description: "Quả cầu tiên tri" },
    { name: "rps", description: "Oẳn tù tì" },
    { name: "love", description: "Độ hợp đôi" },
    { name: "hug", description: "Ôm ai đó", options: [{ name: "user", description: "Người nhận", type: ApplicationCommandOptionType.User, required: false }] },
    { name: "slap", description: "Đánh yêu", options: [{ name: "user", description: "Người nhận", type: ApplicationCommandOptionType.User, required: false }] },
    { name: "say", description: "Cho bot nói lại", options: [{ name: "text", description: "Nội dung", type: ApplicationCommandOptionType.String, required: true }] },
    { name: "quote", description: "Trích dẫn ngẫu nhiên" },
    { name: "mood", description: "Tâm trạng Meyia" },
    { name: "birthday", description: "Sinh nhật (nội bộ)" }
  ]);
  console.log("✅ Slash commands đã đăng ký.");
});

// -------- INTERACTIONS -------- //
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const cmd = interaction.commandName;
  const user = interaction.user;
  const channel = interaction.channel;

  // -------- GIVEAWAY (giữ nguyên form) -------- //
  if (cmd === "giveaway") {
    const prize = interaction.options.getString("prize");
    const duration = ms(interaction.options.getString("time"));
    const winnerCount = interaction.options.getInteger("winners");
    if (!duration) return interaction.reply({ content: "⚠️ Thời gian không hợp lệ!", ephemeral: true });

    const endTime = Date.now() + duration;
    const giveawayId = Math.floor(Math.random() * 999999999);

    const embed = new EmbedBuilder()
      .setColor(MAIN_COLOR)
      .setTitle(`<a:1255341894687260775:1433317867293642858> G I V E A W A Y <a:1255341894687260775:1433317867293642858>`)
      .setDescription(
        `🎁 **Phần thưởng:** ${prize}\n\n` +
        `<a:1255340646248616061:1433317989406605383> Nhấn emoji bên dưới để tham gia!\n\n` +
        `👑 **Tổ chức bởi:** ${user}\n` +
        `🏆 **Số lượng giải:** ${winnerCount}\n` +
        `⏰ **Kết thúc:** <t:${Math.floor(endTime / 1000)}:R>`
      )
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .setImage(interaction.client.user.displayAvatarURL({ dynamic: true, size: 512 }))
      .setFooter({ text: `📛 Mã giveaway: ${giveawayId}` });

    const msg = await channel.send({ embeds: [embed] });
    await msg.react("<a:1261960933270618192:1433286685189341204>");

    const participants = new Set();
    const collector = msg.createReactionCollector({
      filter: (reaction, u) => reaction.emoji.identifier === "1261960933270618192:1433286685189341204" && !u.bot,
      time: duration
    });

    collector.on("collect", (_, u) => participants.add(u.id));
    collector.on("end", async () => {
      let winners = [];
      if (participants.size === 0) {
        winners = [];
      } else {
        const arr = Array.from(participants);
        for (let i = 0; i < winnerCount && arr.length > 0; i++) {
          const idx = Math.floor(Math.random() * arr.length);
          winners.push(arr.splice(idx, 1)[0]);
        }
      }

      const endEmbed = new EmbedBuilder()
        .setColor(MAIN_COLOR)
        .setTitle(`<a:1255341894687260775:1433317867293642858> GIVEAWAY KẾT THÚC <a:1255340646248616061:1433317989406605383>`)
        .setDescription(
          `🎁 **Phần thưởng:** ${prize}\n\n` +
          `${winners.length ? `🏆 **Người chiến thắng:** ${winners.map(id => `<@${id}>`).join(", ")}` : "❌ Không có ai tham gia!"}\n\n` +
          `👑 **Người tổ chức:** ${user}\n📛 **Mã giveaway:** ${giveawayId}`
        )
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .setImage(interaction.client.user.displayAvatarURL({ dynamic: true, size: 512 }));

      await msg.edit({ embeds: [endEmbed] });
      if (winners.length > 0) channel.send(`🎊 Chúc mừng ${winners.map(id => `<@${id}>`).join(", ")} đã thắng **${prize}**!`);
    });

    return interaction.reply({ content: "✅ Giveaway đã được tạo thành công!", ephemeral: true });
  }

  // -------- CÁC LỆNH TIỆN ÍCH & VUI -------- //
  if (cmd === "ping") return interaction.reply(`🏓 Pong! Độ trễ: ${client.ws.ping}ms`);
  if (cmd === "love") return interaction.reply(`💞 Mức độ hợp đôi: ${Math.floor(Math.random() * 101)}%`);
  if (cmd === "rps") return interaction.reply(["✊", "🖐️", "✌️"][Math.floor(Math.random() * 3)]);
  if (cmd === "8ball") return interaction.reply(["Có", "Không", "Có thể", "Hỏi lại sau nhé~"][Math.floor(Math.random() * 4)]);
  if (cmd === "mood") return interaction.reply(["😊 Vui vẻ", "😴 Mệt mỏi", "🥰 Hạnh phúc", "🤔 Trầm tư"][Math.floor(Math.random() * 4)]);
  if (cmd === "quote") return interaction.reply(["✨ Sống là phải vui!", "💫 Bạn làm được!", "🌸 Cứ tiến lên nào!"][Math.floor(Math.random() * 3)]);

  if (cmd === "say") {
    const text = interaction.options.getString("text");
    return interaction.reply({ content: text });
  }

  if (cmd === "xoachat") {
    if (!hasAdminPermission(interaction)) return interaction.reply({ content: "🚫 Bạn không có quyền dùng lệnh này!", ephemeral: true });
    const count = interaction.options.getInteger("count");
    if (count < 1 || count > 99) return interaction.reply({ content: "⚠️ Số lượng phải từ 1–99.", ephemeral: true });
    await interaction.channel.bulkDelete(count, true);
    return interaction.reply({ content: `🧹 Đã xóa ${count} tin nhắn!`, ephemeral: true });
  }

  if (cmd === "avatar") {
    const user = interaction.options.getUser("user") || interaction.user;
    const embed = new EmbedBuilder()
      .setColor(MAIN_COLOR)
      .setTitle(`🖼 Avatar của ${user.username}`)
      .setImage(user.displayAvatarURL({ dynamic: true, size: 512 }));
    return interaction.reply({ embeds: [embed] });
  }

  if (cmd === "info") {
    const embed = new EmbedBuilder()
      .setColor(MAIN_COLOR)
      .setTitle("🌸 Meyia v1.5.0 — All-in-one bot")
      .setDescription("Một cô trợ lý nhỏ xinh giúp bạn quản lý server & mang lại niềm vui 💕")
      .addFields(
        { name: "👑 Người phát triển", value: `<@${OWNER_ID}>`, inline: true },
        { name: "⚙️ Phiên bản", value: "v1.5.0", inline: true },
        { name: "💫 Framework", value: "discord.js v14", inline: true }
      )
      .setThumbnail(client.user.displayAvatarURL())
      .setFooter({ text: "💖 Meyia Bot © 2025" });
    return interaction.reply({ embeds: [embed] });
  }
});

// -------- LOGIN -------- //
const token = process.env.TOKEN || process.env.DISCORD_TOKEN;
if (!token) console.error("❌ Thiếu TOKEN trong .env");
else client.login(token);
