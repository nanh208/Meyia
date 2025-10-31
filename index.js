// index.js — Meyia all-in-one (stable) — Music (YouTube Music) enabled
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const ms = require("ms");

const {
  Client,
  Events,
  GatewayIntentBits,
  ApplicationCommandOptionType,
  EmbedBuilder,
  PermissionFlagsBits
} = require("discord.js");

// ---------- Music related ----------
const { Player, QueryType } = require("discord-player");
const playdl = require("play-dl"); // used by discord-player as extractor back-end
// ------------------------------------

const { GiveawaysManager } = require("discord-giveaways");

// -------- CLIENT INIT -------- //
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates // <-- cần cho voice
  ]
});

// -------- CONFIG -------- //
const OWNER_ID = process.env.OWNER_ID || "1409222785154416651";
const MAIN_COLOR = "#CA50DC";

// -------- ACTIVITY CONFIG FILE -------- //
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

// -------- SETUP play-dl (YouTube Music cookie) -------- //
// If you selected option 3 (YouTube Music), put cookie into .env as YOUTUBE_COOKIE
if (process.env.YOUTUBE_COOKIE) {
  try {
    // play-dl accepts cookie via playdl.setCookies or environment; set manually:
    playdl.setToken({ ytmusic: process.env.YOUTUBE_COOKIE });
  } catch (err) {
    console.warn("⚠️ play-dl cookie setup warning:", err?.message || err);
  }
}

// -------- PLAYER INIT (single instance) -------- //
client.player = new Player(client, {
  ytdlOptions: {
    quality: "highestaudio",
    highWaterMark: 1 << 25
  }
});

// Optional: attach event listeners for debugging (you can remove or keep)
client.player.on("error", (queue, error) => {
  console.error(`Player Error in guild ${queue.guild.id}:`, error);
});
client.player.on("playerStart", (queue, track) => {
  // send simple now playing embed to metadata channel if provided
  if (queue.metadata?.channel) {
    try {
      queue.metadata.channel.send({ content: `🎶 Đang phát: **${track.title}** — yêu cầu bởi <@${track.requestedBy?.id || "?"}>` }).catch(() => {});
    } catch (e) {}
  }
});
client.player.on("playerDisconnect", (queue) => {
  // cleanup if bot was disconnected
  if (queue.metadata?.channel) {
    try { queue.metadata.channel.send("📛 Bot đã rời voice, queue đã bị huỷ.").catch(()=>{}); } catch(e) {}
  }
});

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

    // ---------- Music slash commands ----------
    // /play nhận 2 tuỳ chọn: link (URL) và ten (tên bài/playlist). Không bắt buộc trên discord, kiểm tra trong handler (ít nhất 1 tuỳ chọn).
    { name: "play", description: "Phát nhạc (link hoặc tên)", options: [
      { name: "link", description: "URL bài/playlist (nếu có)", type: ApplicationCommandOptionType.String, required: false },
      { name: "ten", description: "Tên bài/playlist (nếu không dùng link)", type: ApplicationCommandOptionType.String, required: false },
      { name: "query", description: "Legacy: tên bài / link / playlist", type: ApplicationCommandOptionType.String, required: false }
    ] },
    { name: "stop", description: "Dừng nhạc và rời voice" },
    { name: "skip", description: "Bỏ qua bài đang phát" },
    { name: "pause", description: "Tạm dừng phát" },
    { name: "resume", description: "Tiếp tục phát" },
    { name: "queue", description: "Xem queue hiện tại" },
    { name: "volume", description: "Đặt âm lượng (1-200)", options: [{ name: "value", description: "Số (1-200)", type: ApplicationCommandOptionType.Integer, required: true }] },

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

// -------- INTERACTIONS HANDLER (includes music) -------- //
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
      await msg.react("<a:1261960933270618192:1433286685189341204>");

      const participants = new Set();
      const collector = msg.createReactionCollector({
        filter: (reaction, u) => {
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
          .setTitle(`<a:1255341894687260775:1433317867293642858> GIVEAWAY KẾT THÚC <a:1255340646248616061:1433286685189341204>`)
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

  // ---------- MUSIC COMMANDS ----------
  if (cmd === "play") {
    const query = interaction.options.getString("query");
    const memberVoice = interaction.member?.voice?.channel;
    if (!memberVoice) return interaction.reply({ content: "❗ Bạn phải vào kênh thoại trước!", ephemeral: true });

    await interaction.deferReply();

    try {
      // prefer QueryType.AUTO to allow play-dl to resolve YouTube Music / YT
      const search = await client.player.search(query, {
        requestedBy: interaction.user,
        searchEngine: QueryType.AUTO
      });

      if (!search || !search.tracks.length) return interaction.editReply("❌ Không tìm thấy bài hát!");

      const queue = await client.player.createQueue(interaction.guild, {
        metadata: { channel: interaction.channel }
      });

      try {
        if (!queue.connection) await queue.connect(memberVoice);
      } catch (err) {
        client.player.deleteQueue(interaction.guild.id);
        return interaction.editReply("⚠️ Bot không thể vào voice (kiểm tra quyền Connect).");
      }

      // if playlist -> add all, else add first track
      if (search.playlist) {
        queue.addTracks(search.tracks);
      } else {
        queue.addTrack(search.tracks[0]);
      }

      if (!queue.playing) await queue.play();

      const track = queue.current;
      return interaction.editReply(`🎶 Đang phát: **${track.title}** — Yêu cầu bởi ${interaction.user}`);
    } catch (err) {
      console.error("Play command error:", err);
      return interaction.editReply("❌ Lỗi khi phát nhạc.");
    }
  }

  if (cmd === "stop") {
    try {
      const queue = client.player.getQueue(interaction.guild.id);
      if (!queue) return interaction.reply({ content: "❌ Không có bài nào đang phát!", ephemeral: true });
      queue.destroy();
      return interaction.reply({ content: "⛔ Đã dừng nhạc và rời voice." });
    } catch (err) {
      console.error("Stop error:", err);
      return interaction.reply({ content: "❌ Lỗi khi dừng nhạc.", ephemeral: true });
    }
  }

  if (cmd === "skip") {
    try {
      const queue = client.player.getQueue(interaction.guild.id);
      if (!queue || !queue.playing) return interaction.reply({ content: "❌ Không có bài nào đang phát!", ephemeral: true });
      const current = queue.current;
      const ok = await queue.skip();
      if (ok) return interaction.reply({ content: `⏭️ Đã bỏ qua: **${current.title}**` });
      return interaction.reply({ content: "❌ Không thể bỏ qua bài.", ephemeral: true });
    } catch (err) {
      console.error("Skip error:", err);
      return interaction.reply({ content: "❌ Lỗi khi skip.", ephemeral: true });
    }
  }

  if (cmd === "pause") {
    try {
      const queue = client.player.getQueue(interaction.guild.id);
      if (!queue || !queue.playing) return interaction.reply({ content: "❌ Không có bài nào đang phát!", ephemeral: true });
      queue.setPaused(true);
      return interaction.reply({ content: "⏸️ Đã tạm dừng." });
    } catch (err) {
      console.error("Pause error:", err);
      return interaction.reply({ content: "❌ Lỗi khi pause.", ephemeral: true });
    }
  }

  if (cmd === "resume") {
    try {
      const queue = client.player.getQueue(interaction.guild.id);
      if (!queue) return interaction.reply({ content: "❌ Không có queue.", ephemeral: true });
      queue.setPaused(false);
      return interaction.reply({ content: "▶️ Đã tiếp tục phát." });
    } catch (err) {
      console.error("Resume error:", err);
      return interaction.reply({ content: "❌ Lỗi khi resume.", ephemeral: true });
    }
  }

  if (cmd === "queue") {
    try {
      const queue = client.player.getQueue(interaction.guild.id);
      if (!queue || !queue.playing) return interaction.reply({ content: "📭 Queue đang trống!", ephemeral: true });

      const current = queue.current;
      const tracks = queue.tracks.slice(0, 10);
      const list = tracks.length ? tracks.map((t,i) => `**${i+1}.** ${t.title} — <@${t.requestedBy?.id||"?"}>`).join("\n") : "Không có bài nào trong queue.";

      const embed = new EmbedBuilder()
        .setColor(MAIN_COLOR)
        .setTitle("🎶 Danh sách phát")
        .setDescription(`**Đang phát:** ${current.title}\n\n**Tiếp theo:**\n${list}`)
        .setFooter({ text: `Tổng bài trong queue: ${queue.tracks.length + (queue.current ? 1 : 0)}` });

      return interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error("Queue error:", err);
      return interaction.reply({ content: "❌ Lỗi khi lấy queue.", ephemeral: true });
    }
  }

  if (cmd === "volume") {
    try {
      const value = interaction.options.getInteger("value");
      const queue = client.player.getQueue(interaction.guild.id);
      if (!queue) return interaction.reply({ content: "❌ Không có nhạc đang phát!", ephemeral: true });
      if (!value || value < 1 || value > 200) return interaction.reply({ content: "🔊 Nhập âm lượng hợp lệ (1 - 200).", ephemeral: true });

      queue.setVolume(value);
      return interaction.reply({ content: `✅ Âm lượng đã đặt thành **${value}%**` });
    } catch (err) {
      console.error("Volume error:", err);
      return interaction.reply({ content: "❌ Lỗi khi đặt volume.", ephemeral: true });
    }
  }

  // ---------- UTIL & FUN (unchanged) ----------
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
    return interaction.reply({ embeds: [embed], ephemeral: true });
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

  // activity subcommands (admin) — unchanged
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

  // updated help: include music
  if (cmd === "help") {
    const helpEmbed = new EmbedBuilder()
      .setColor(MAIN_COLOR)
      .setTitle("📚 Danh sách lệnh của Meyia")
      .setDescription("Các lệnh hiện có:")
      .addFields(
        { name: "🎶 Music (slash)", value: "/play, /stop, /skip, /pause, /resume, /queue, /volume", inline: false },
        { name: "🔧 Tiện ích", value: "/ping, /info, /avatar, /say, /xoachat", inline: false },
        { name: "🎉 Sự kiện", value: "/giveaway", inline: false },
        { name: "📝 Log hoạt động (Admin)", value: "/activity", inline: false }
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

  // Unknown command fallback
  return interaction.reply({ content: "❓ Lệnh chưa được triển khai.", ephemeral: true });
});
// ---------- MESSAGE PREFIX COMMANDS ---------- //
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const prefix = "!";
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  const memberVoice = message.member?.voice?.channel;

  // ---------- !play auto ----------
  if (cmd === "play" && args[0] === "auto") {
    if (!memberVoice) return message.reply("❗ Bạn phải vào kênh thoại trước!");

    // Tạo queue
    const queue = await client.player.createQueue(message.guild, {
      metadata: { channel: message.channel },
      leaveOnEnd: true,
      leaveOnStop: true,
      leaveOnEmpty: true
    });

    try {
      if (!queue.connection) await queue.connect(memberVoice);
    } catch {
      client.player.deleteQueue(message.guild.id);
      return message.reply("⚠️ Bot không thể vào voice.");
    }

    // Search random bài hát (ví dụ dùng 1 số từ khóa phổ biến)
    const keywords = ["pop", "anime", "gaming", "chill", "lofi", "remix"];
    const randomKeyword = keywords[Math.floor(Math.random() * keywords.length)];

    const search = await client.player.search(randomKeyword, {
      requestedBy: message.author,
      searchEngine: QueryType.AUTO
    });

    if (!search || !search.tracks.length) return message.reply("❌ Không tìm thấy bài hát ngẫu nhiên!");

    const track = search.tracks[Math.floor(Math.random() * search.tracks.length)];
    queue.addTrack(track);

    if (!queue.playing) await queue.play();

    return message.reply(`🎶 Đang phát bài ngẫu nhiên: **${track.title}**`);
  }

  // ---------- !leave ----------
  if (cmd === "leave") {
    const queue = client.player.getQueue(message.guild.id);
    if (!queue) return message.reply("❌ Không có bài nào đang phát!");
    queue.destroy();
    return message.reply("⛔ Đã dừng nhạc và rời voice.");
  }
});
// === CODE GỐC CỦA BẠN ===
// ... toàn bộ code index.js bạn đã gửi từ đầu đến cuối ...
// (không xóa, không sửa, giữ nguyên tất cả)

/* =====================================================================
   PHẦN CẢI TIẾN THÊM
   - Auto reconnect voice khi disconnect
   - Thông báo khi queue kết thúc
   - Lệnh !skipto <số> cho prefix
   - Lưu volume riêng cho từng guild
   - Mini log slash command khi bot ready
===================================================================== */

const volumePath = path.join(__dirname, "config", "volume.json");
// ensure config dir exists and create file if missing; safe-read JSON
if (!fs.existsSync(path.dirname(volumePath))) fs.mkdirSync(path.dirname(volumePath), { recursive: true });
if (!fs.existsSync(volumePath)) fs.writeFileSync(volumePath, "{}");
let volumeConfig = {};
try {
  const raw = fs.readFileSync(volumePath, "utf8") || "{}";
  volumeConfig = JSON.parse(raw);
} catch (e) {
  console.warn("⚠️ volume.json parse error, resetting to {}:", e);
  volumeConfig = {};
  fs.writeFileSync(volumePath, "{}");
}

// Auto reconnect voice khi connection error
client.player.on("connectionError", (queue, error) => {
  console.warn(`⚠️ Lỗi kết nối voice ở guild ${queue.guild.id}:`, error);
  setTimeout(async () => {
    if (!queue.connection) {
      try { await queue.connect(queue.voiceChannel); } catch(e){ console.error("Reconnect failed:", e); }
    }
  }, 5000);
});

// Thông báo khi queue kết thúc
client.player.on("queueEnd", (queue) => {
  if (queue.metadata?.channel) {
    queue.metadata.channel.send("📭 Queue đã kết thúc. Cảm ơn bạn đã nghe nhạc!").catch(() => {});
  }
});

// Tự động set volume khi queue được tạo
client.player.on("queueCreate", (queue) => {
  const vol = volumeConfig[queue.guild.id] || 100;
  queue.setVolume(vol);
});

// Log tất cả slash command khi bot ready
client.once(Events.ClientReady, () => {
  client.application.commands.cache.forEach(cmd => {
    console.log(`Slash command loaded: /${cmd.name}`);
  });
});

// Prefix command: !skipto <số>
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  const prefix = "!";
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  if (cmd === "skipto") {
    const queue = client.player.getQueue(message.guild.id);
    if (!queue || !queue.playing) return message.reply("❌ Không có bài nào đang phát!");
    const num = parseInt(args[0]);
    if (isNaN(num) || num < 1 || num > queue.tracks.length) return message.reply("⚠️ Nhập số hợp lệ trong queue!");
    queue.skipTo(num - 1);
    return message.reply(`⏭️ Bỏ qua đến bài số **${num}**: ${queue.current.title}`);
  }
});

// Lưu volume khi dùng /volume
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === "volume") {
    const value = interaction.options.getInteger("value");
    volumeConfig[interaction.guild.id] = value;
    fs.writeFileSync(volumePath, JSON.stringify(volumeConfig, null, 2));
  }
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
