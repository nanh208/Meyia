// index.js — Meyia all-in-one (stable)
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

// -------- CONFIG -------- //
const OWNER_ID = process.env.OWNER_ID || "1409222785154416651";
const MAIN_COLOR = "#CA50DC";

// create config folder/file if not exists (used by some features)
const activityPath = path.join(__dirname, "config", "activity.json");
if (!fs.existsSync(path.dirname(activityPath))) fs.mkdirSync(path.dirname(activityPath), { recursive: true });
if (!fs.existsSync(activityPath)) fs.writeFileSync(activityPath, "{}");
let activityConfig = JSON.parse(fs.readFileSync(activityPath, "utf8"));
function saveActivityConfig() { fs.writeFileSync(activityPath, JSON.stringify(activityConfig, null, 2)); }
function logActivity(guildId, msg) {
  const cfg = activityConfig[guildId];
  if (!cfg || !cfg.enabled || !cfg.channelId) return;
  const ch = client.channels.cache.get(cfg.channelId);
  if (ch) ch.send(msg).catch(() => {});
}

function hasAdminPermission(i) {
  return (
    i?.member?.permissions?.has(PermissionFlagsBits.Administrator) ||
    i?.user?.id === OWNER_ID ||
    i?.member?.permissions?.has(PermissionFlagsBits.ManageGuild)
  );
}

// -------- GIVEAWAY MANAGER (KEEP ORIGINAL BEHAVIOR) -------- //
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

// -------- READY & REGISTER SLASH COMMANDS -------- //
client.once(Events.ClientReady, async () => {
  console.log(`✅ Bot MEYIA đã sẵn sàng (${client.user.tag})`);

  // Commands array (every option has description to avoid Invalid Form Body)
  const commands = [
    { name: "help", description: "Xem danh sách lệnh của bot" },
    { name: "status", description: "Xem trạng thái bot" },
    {
      name: "giveaway",
      description: "Tạo giveaway 🎉",
      options: [
        { name: "time", description: "Thời gian (ví dụ: 1m, 1h, 1d)", type: ApplicationCommandOptionType.String, required: true },
        { name: "winners", description: "Số người thắng", type: ApplicationCommandOptionType.Integer, required: true },
        { name: "prize", description: "Phần thưởng", type: ApplicationCommandOptionType.String, required: true }
      ]
    },
    { name: "ping", description: "Kiểm tra độ trễ" },
    { name: "8ball", description: "Quả cầu tiên tri" },
    { name: "rps", description: "Oẳn tù tì" },
    { name: "love", description: "Độ hợp đôi" },
    { name: "mood", description: "Tâm trạng Meyia" },
    { name: "quote", description: "Trích dẫn ngẫu nhiên" },
    { name: "say", description: "Cho bot nói lại nội dung bạn nhập", options: [{ name: "text", description: "Nội dung bot sẽ nói", type: ApplicationCommandOptionType.String, required: true }] },
    { name: "avatar", description: "Xem avatar của user (nếu không chọn thì lấy bạn)", options: [{ name: "user", description: "Người cần xem avatar", type: ApplicationCommandOptionType.User, required: false }] },
    { name: "xoachat", description: "Xóa tin nhắn (1-99)", options: [{ name: "count", description: "Số lượng tin nhắn muốn xóa (1-99)", type: ApplicationCommandOptionType.Integer, required: true }] },
    { name: "info", description: "Thông tin bot" },
    // activity commands placeholder (admin)
    {
      name: "activity",
      description: "Quản lý log hoạt động (chỉ admin)",
      options: [
        {
          name: "setup",
          description: "Chọn kênh log",
          type: ApplicationCommandOptionType.Subcommand,
          options: [{ name: "channel", description: "Kênh log (chọn)", type: ApplicationCommandOptionType.Channel, required: true }]
        },
        { name: "enable", description: "Bật log hoạt động", type: ApplicationCommandOptionType.Subcommand },
        { name: "disable", description: "Tắt log hoạt động", type: ApplicationCommandOptionType.Subcommand }
      ]
    }
  ];

  try {
    await client.application.commands.set(commands);
    console.log("✅ Slash commands đã đăng ký.");
  } catch (err) {
    console.error("❌ Lỗi khi đăng ký slash commands:", err);
  }
});

// -------- INTERACTIONS HANDLER -------- //
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const cmd = interaction.commandName;

  // ---------- GIVEAWAY (KEEP ORIGINAL FUNCTIONALITY) ----------
  if (cmd === "giveaway") {
    try {
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
          `👑 **Tổ chức bởi:** ${interaction.user}\n` +
          `🏆 **Số lượng giải:** ${winnerCount}\n` +
          `⏰ **Kết thúc:** <t:${Math.floor(endTime / 1000)}:R>`
        )
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .setImage(interaction.client.user.displayAvatarURL({ dynamic: true, size: 512 }))
        .setFooter({ text: `📛 Mã giveaway: ${giveawayId}` });

      const msg = await interaction.channel.send({ embeds: [embed] });
      // react with original emoji string — keep same as you had
      await msg.react("<a:1261960933270618192:1433286685189341204>");

      const participants = new Set();
      const collector = msg.createReactionCollector({
        filter: (reaction, u) => {
          // when reaction is a custom animated emoji, reaction.emoji.id will be the numeric id
          try {
            return reaction.emoji.id === "1261960933270618192" && !u.bot;
          } catch (e) {
            return false;
          }
        },
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
            `👑 **Người tổ chức:** ${interaction.user}\n📛 **Mã giveaway:** ${giveawayId}`
          )
          .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
          .setImage(interaction.client.user.displayAvatarURL({ dynamic: true, size: 512 }));

        await msg.edit({ embeds: [endEmbed] });
        if (winners.length > 0) interaction.channel.send(`🎊 Chúc mừng ${winners.map(id => `<@${id}>`).join(", ")} đã thắng **${prize}**!`);
      });

      return interaction.reply({ content: "✅ Giveaway đã được tạo thành công!", ephemeral: true });
    } catch (err) {
      console.error("Giveaway error:", err);
      return interaction.reply({ content: "❌ Lỗi khi tạo giveaway.", ephemeral: true });
    }
  }

  // ---------- UTIL & FUN ---------- //
  if (cmd === "ping") return interaction.reply(`🏓 Pong! Độ trễ: ${client.ws.ping}ms`);
  if (cmd === "love") return interaction.reply(`💞 Mức độ hợp đôi: ${Math.floor(Math.random() * 101)}%`);
  if (cmd === "rps") return interaction.reply(["✊", "🖐️", "✌️"][Math.floor(Math.random() * 3)]);
  if (cmd === "8ball") return interaction.reply(["Có", "Không", "Có thể", "Hỏi lại sau nhé~"][Math.floor(Math.random() * 4)]);
  if (cmd === "mood") return interaction.reply(["😊 Vui vẻ", "😴 Mệt mỏi", "🥰 Hạnh phúc", "🤔 Trầm tư"][Math.floor(Math.random() * 4)]);
  if (cmd === "quote") return interaction.reply(["✨ Sống là phải vui!", "💫 Bạn làm được!", "🌸 Cứ tiến lên nào!"][Math.floor(Math.random() * 3)]);

  if (cmd === "say") {
    const text = interaction.options.getString("text");
    if (!text) return interaction.reply({ content: "⚠️ Bạn chưa nhập nội dung.", ephemeral: true });
    return interaction.reply({ content: text });
  }

  if (cmd === "avatar") {
    const user = interaction.options.getUser("user") || interaction.user;
    const embed = new EmbedBuilder()
      .setColor(MAIN_COLOR)
      .setTitle(`🖼 Avatar của ${user.username}`)
      .setImage(user.displayAvatarURL({ dynamic: true, size: 512 }));
    return interaction.reply({ embeds: [embed] });
  }

  if (cmd === "xoachat") {
    if (!hasAdminPermission(interaction)) return interaction.reply({ content: "🚫 Bạn không có quyền dùng lệnh này!", ephemeral: true });
    const count = interaction.options.getInteger("count");
    if (!count || count < 1 || count > 99) return interaction.reply({ content: "⚠️ Số lượng phải từ 1–99.", ephemeral: true });
    try {
      await interaction.channel.bulkDelete(count, true);
      return interaction.reply({ content: `🧹 Đã xóa ${count} tin nhắn!`, ephemeral: true });
    } catch (err) {
      console.error("bulkDelete error:", err);
      return interaction.reply({ content: "❌ Không thể xóa tin nhắn (có thể vì tin nhắn quá cũ).", ephemeral: true });
    }
  }

  // activity subcommands (admin)
  if (cmd === "activity") {
    if (!hasAdminPermission(interaction)) return interaction.reply({ content: "🚫 Bạn không có quyền.", ephemeral: true });
    const sub = interaction.options.getSubcommand(false);
    if (sub === "setup") {
      const ch = interaction.options.getChannel("channel");
      activityConfig[interaction.guildId] = activityConfig[interaction.guildId] || {};
      activityConfig[interaction.guildId].channelId = ch.id;
      saveActivityConfig();
      return interaction.reply({ content: `✅ Đã đặt kênh log thành <#${ch.id}>`, ephemeral: true });
    } else if (sub === "enable") {
      activityConfig[interaction.guildId] = activityConfig[interaction.guildId] || {};
      activityConfig[interaction.guildId].enabled = true;
      saveActivityConfig();
      return interaction.reply({ content: "✅ Đã bật log hoạt động.", ephemeral: true });
    } else if (sub === "disable") {
      activityConfig[interaction.guildId] = activityConfig[interaction.guildId] || {};
      activityConfig[interaction.guildId].enabled = false;
      saveActivityConfig();
      return interaction.reply({ content: "✅ Đã tắt log hoạt động.", ephemeral: true });
    } else {
      return interaction.reply({ content: "❓ Subcommand không hợp lệ.", ephemeral: true });
    }
  }

  if (cmd === "help") {
    const helpEmbed = new EmbedBuilder()
      .setColor(MAIN_COLOR)
      .setTitle("📚 Danh sách lệnh của Meyia")
      .setDescription("Các lệnh hiện có:")
      .addFields(
        { name: "/ping", value: "Kiểm tra độ trễ", inline: true },
        { name: "/info", value: "Thông tin bot", inline: true },
        { name: "/avatar", value: "Xem avatar", inline: true },
        { name: "/say", value: "Cho bot nói lại", inline: true },
        { name: "/xoachat", value: "Xóa tin nhắn (Admin)", inline: true },
        { name: "/giveaway", value: "Tạo giveaway 🎉", inline: true },
        { name: "/activity", value: "Quản lý log hoạt động (Admin)", inline: true }
      );
    return interaction.reply({ embeds: [helpEmbed], ephemeral: true });
  }

  if (cmd === "status") {
    const uptimeSeconds = Math.floor(client.uptime / 1000) || 0;
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = uptimeSeconds % 60;
    const uptimeStr = `${hours}h ${minutes}m ${seconds}s`;

    const embed = new EmbedBuilder()
      .setColor(MAIN_COLOR)
      .setTitle("💗 Trạng thái bot")
      .addFields(
        { name: "Ping", value: `${client.ws.ping}ms`, inline: true },
        { name: "Servers", value: `${client.guilds.cache.size}`, inline: true },
        { name: "Uptime", value: uptimeStr, inline: true }
      );
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (cmd === "info") {
    const embed = new EmbedBuilder()
      .setColor(MAIN_COLOR)
      .setTitle("🌸 Meyia — All-in-one bot")
      .setDescription("Một cô trợ lý nhỏ xinh giúp bạn quản lý server & mang lại niềm vui 💕")
      .addFields(
        { name: "Developer", value: `<@${OWNER_ID}>`, inline: true },
        { name: "Version", value: "v1.5.1", inline: true },
        { name: "Framework", value: "discord.js v14", inline: true }
      )
      .setFooter({ text: "💖 Meyia Bot © 2025" });
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // Unknown command fallback (shouldn't happen)
  return interaction.reply({ content: "❓ Lệnh chưa được triển khai.", ephemeral: true });
});

// -------- LOGIN -------- //
const token = process.env.TOKEN || process.env.DISCORD_TOKEN;
if (!token) {
  console.error("❌ Thiếu TOKEN trong .env");
  process.exit(1);
} else {
  client.login(token).catch(err => {
    console.error("Login error:", err);
    process.exit(1);
  });
}
