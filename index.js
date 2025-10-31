// index.js — Meyia all-in-one (v1.3.1 HYBRID)
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

// ----------- LOAD CONFIG -----------
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

// ----------- SETTINGS -----------
const OWNER_ID = process.env.OWNER_ID || "1409222785154416651";
let mutedChannels = new Set();

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

function getStatusString() {
  return `📡 **Trạng thái bot:**\n🧠 Chat AI: 🔒 Tắt\n🔇 Kênh mute: ${mutedChannels.size ? Array.from(mutedChannels).map(id => `<#${id}>`).join(", ") : "Không"}`;
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

// ----------- READY -----------
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

// ----------- INTERACTIONS (Slash Commands) -----------
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const cmd = interaction.commandName;
  const isAdmin = hasAdminPermission(interaction);

  // 🎁 GIVEAWAY (giữ nguyên bản đặc biệt)
  if (cmd === "giveaway") {
    const prize = interaction.options.getString("prize");
    const duration = ms(interaction.options.getString("time"));
    const winnerCount = interaction.options.getInteger("winners");
    const host = interaction.user;
    const channel = interaction.channel;

    if (!prize || !duration || !winnerCount)
      return interaction.reply({ content: "⚠️ Vui lòng nhập đủ thông tin giveaway!", ephemeral: true });
    if (!duration)
      return interaction.reply({ content: "⚠️ Thời gian không hợp lệ! (vd: 1m, 1h, 1d)", ephemeral: true });

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
      filter: (reaction, user) =>
        reaction.emoji.identifier === "1261960933270618192:1433286685189341204" && !user.bot,
      time: duration
    });

    collector.on("collect", (_, user) => participants.add(user.id));

    collector.on("end", async () => {
      let winners = [];
      let winnerText;

      if (participants.size === 0) {
        winnerText = "❌ Không có ai tham gia giveaway này!";
      } else {
        const all = Array.from(participants);
        for (let i = 0; i < winnerCount && all.length > 0; i++) {
          const index = Math.floor(Math.random() * all.length);
          winners.push(all.splice(index, 1)[0]);
        }
        winnerText = `🏆 **Người chiến thắng:** ${winners.map(id => `<@${id}>`).join(", ")}`;
      }

      const endEmbed = new EmbedBuilder()
        .setColor("#ea4ce7ff")
        .setTitle(`<a:1255341894687260775:1433317867293642858> G I V E A W A Y ĐÃ KẾT THÚC <a:1255340646248616061:1433317989406605383>`)
        .setDescription(
          `🎁 **Phần thưởng:** ${prize}\n\n` +
          `${winnerText}\n` +
          `👑 **Người tổ chức:** ${host}\n\n` +
          `📛 **Mã giveaway:** ${giveawayId}`
        )
        .setThumbnail(host.displayAvatarURL({ dynamic: true }))
        .setImage(interaction.client.user.displayAvatarURL({ dynamic: true, size: 512 }));

      await msg.edit({ embeds: [endEmbed] });

      if (winners.length > 0)
        await channel.send(`🎊 Chúc mừng ${winners.map(id => `<@${id}>`).join(", ")} đã thắng **${prize}**!`);
    });

    return interaction.reply({ content: "✅ Giveaway đã được tạo thành công!", ephemeral: true });
  }

  // 🎀 HELP chi tiết
  if (cmd === "help") {
    const helpEmbed = new EmbedBuilder()
      .setColor(0xFFC0CB)
      .setTitle("💖 Danh sách lệnh của Meyia Bot")
      .setDescription("✨ Meyia là bot hỗ trợ quản lý & giải trí, giúp server của bạn sinh động hơn 💕\n\n📚 **Dùng được cả `/` và `!`:**")
      .addFields(
        {
          name: "🛠️ Quản trị",
          value:
            "• `/activity setup <channel>` — Thiết lập kênh log.\n" +
            "• `/activity enable` — Bật ghi log.\n" +
            "• `/activity disable` — Tắt ghi log.\n" +
            "• `/xoachat <count>` — Xóa nhanh tin nhắn.\n" +
            "• `/status` — Xem trạng thái bot."
        },
        {
          name: "🎉 Giải trí",
          value:
            "• `/giveaway <time> <winners> <prize>` — Tạo giveaway 🎁.\n" +
            "• `/8ball` — Quả cầu tiên tri 🎱.\n" +
            "• `/rps` — Oẳn tù tì ✊🖐️✌️.\n" +
            "• `/love` — Độ hợp đôi 💞.\n" +
            "• `/hug`, `/slap` — Ôm hoặc đánh yêu ai đó 😝."
        },
        {
          name: "💬 Tiện ích",
          value:
            "• `/say <text>` — Bot nói lại.\n" +
            "• `/quote` — Câu nói ngẫu nhiên.\n" +
            "• `/mood` — Tâm trạng bot 🩷.\n" +
            "• `/avatar [user]` — Xem avatar.\n" +
            "• `/info` — Thông tin bot.\n" +
            "• `/ping` — Kiểm tra độ trễ."
        }
      )
      .setFooter({ text: "💫 Meyia v1.3.1 — Đáng yêu, thông minh và hữu ích 💕" });

    return interaction.reply({ embeds: [helpEmbed], ephemeral: true });
  }

  // -------- INFO + CÁC LỆNH KHÁC GIỮ NGUYÊN --------
  if (cmd === "info") {
    const infoEmbed = new EmbedBuilder()
      .setColor(0xFFB6C1)
      .setTitle("🌸 Meyia v1.3.1 — All-in-one bot")
      .setDescription("Một cô trợ lý nhỏ xinh giúp bạn quản lý server và tạo không khí vui vẻ 💕")
      .addFields(
        { name: "👑 Người phát triển", value: `<@${OWNER_ID}>`, inline: true },
        { name: "⚙️ Phiên bản", value: "v1.3.1", inline: true },
        { name: "🩷 Framework", value: "discord.js v14" }
      )
      .setThumbnail(client.user.displayAvatarURL())
      .setFooter({ text: "💫 Meyia Bot © 2025" });
    return interaction.reply({ embeds: [infoEmbed] });
  }

  // Các lệnh cũ (ping, xoachat, love, rps...) giữ nguyên logic
});

// ----------- PREFIX COMMANDS -----------
client.on(Events.MessageCreate, async (msg) => {
  if (!msg.guild || msg.author.bot) return;
  const prefix = "!";
  if (!msg.content.startsWith(prefix)) return;

  const args = msg.content.slice(prefix.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  if (cmd === "help") {
    const helpEmbed = new EmbedBuilder()
      .setColor(0xFFC0CB)
      .setTitle("💖 Danh sách lệnh của Meyia Bot")
      .setDescription("✨ Dùng được cả `/` và `!`\nChi tiết lệnh ở dưới đây:")
      .addFields(
        { name: "🛠️ Quản trị", value: "`!activity`, `!xoachat`, `!status`" },
        { name: "🎉 Giải trí", value: "`!giveaway`, `!8ball`, `!rps`, `!love`, `!hug`, `!slap`" },
        { name: "💬 Tiện ích", value: "`!say`, `!quote`, `!mood`, `!avatar`, `!info`, `!ping`" }
      )
      .setFooter({ text: "💫 Meyia Bot v1.3.1 💕" });
    return msg.reply({ embeds: [helpEmbed] });
  }

  if (cmd === "ping") return msg.reply(`🏓 Pong! ${Math.round(client.ws.ping)}ms`);
  if (cmd === "love") return msg.reply(`💞 Hợp đôi: ${Math.floor(Math.random() * 101)}%`);
  if (cmd === "rps") return msg.reply(["✊", "🖐️", "✌️"][Math.floor(Math.random() * 3)]);
  if (cmd === "8ball") return msg.reply(["Có", "Không", "Có thể", "Hỏi lại sau"][Math.floor(Math.random() * 4)]);
  if (cmd === "quote") return msg.reply(["Cuộc sống là hành trình.", "Cười lên nào!", "Bạn làm được!"][Math.floor(Math.random() * 3)]);
  if (cmd === "mood") return msg.reply(["😊 Vui", "😴 Mệt", "🥰 Hạnh phúc", "🤔 Nghĩ ngợi"][Math.floor(Math.random() * 4)]);
  if (cmd === "say") return msg.reply(args.join(" ") || "Bạn chưa nhập nội dung!");
  if (cmd === "info") return msg.reply("💫 Meyia v1.3.1 — Đáng yêu & hữu ích 💕");
});

// ----------- LOG ACTIVITY EVENTS -----------
client.on(Events.GuildMemberAdd, m => logActivity(m.guild.id, `🟢 ${m.user.tag} vừa tham gia!`));
client.on(Events.GuildMemberRemove, m => logActivity(m.guild.id, `🔴 ${m.user.tag} đã rời server.`));
client.on(Events.MessageCreate, msg => {
  if (!msg.guild || msg.author.bot) return;
  logActivity(msg.guild.id, `💬 ${msg.author.tag}: ${msg.content}`);
});

// ----------- LOGIN -----------
const token = process.env.TOKEN || process.env.DISCORD_TOKEN;
if (!token) console.error("❌ Thiếu TOKEN trong .env");
else client.login(token);
