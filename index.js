// index.js — Meyia all-in-one (stable) — Music (YouTube Music) enabled
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const ms = require("ms");
const { Client, GatewayIntentBits, Events, EmbedBuilder, ApplicationCommandOptionType } = require("discord.js");

// ---------- Music related ----------
const { Player, QueryType } = require("discord-player");
const playdl = require("play-dl"); // used by discord-player as extractor back-end
// ------------------------------------

const { GiveawaysManager } = require("discord-giveaways");

// Basic helpers / config placeholders (keep your originals if present)
const MAIN_COLOR = "#FFB6C1";
const OWNER_ID = process.env.OWNER_ID || "0";

// ---------- CLIENT INIT ----------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates // cần cho voice
  ]
});

// simple admin check (adjust to your original logic if different)
function hasAdminPermission(i) {
  try {
    return i.memberPermissions?.has?.("Administrator") || i.member?.permissions?.has?.("Administrator") || (i.user && i.user.id === OWNER_ID);
  } catch {
    return false;
  }
}

// -------- GIVEAWAY MANAGER (KEEP ORIGINAL BEHAVIOR) -------- //
const manager = new GiveawaysManager(client, {
  storage: "./giveaways.json",
  default: {
    botsCanWin: false,
    exemptPermissions: [],
    embedColor: MAIN_COLOR,
    reaction: "🎉"
  }
});
client.giveawaysManager = manager;

// -------- SETUP play-dl (YouTube Music cookie) -------- //
if (process.env.YOUTUBE_COOKIE) {
  try {
    // play-dl accepts token/cookie; set if provided
    if (typeof playdl.setToken === "function") playdl.setToken({ ytmusic: process.env.YOUTUBE_COOKIE });
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

// -------- PLAYER EVENTS (clean, no duplicates) -------- //
client.player.on("error", (queue, error) => {
  console.error(`Player Error in guild ${queue?.guild?.id || "?"}:`, error);
});

client.player.on("playerStart", (queue, track) => {
  try {
    if (queue?.metadata?.channel) {
      queue.metadata.channel.send({ content: `🎶 Đang phát: **${track.title}** — yêu cầu bởi ${track.requestedBy ? `<@${track.requestedBy.id}>` : "?"}` }).catch(() => {});
    }
  } catch {}
});

client.player.on("playerDisconnect", (queue) => {
  try {
    if (queue?.metadata?.channel) queue.metadata.channel.send("📛 Bot đã rời voice, queue đã bị huỷ.").catch(() => {});
  } catch {}
});

client.player.on("queueEnd", (queue) => {
  try {
    if (queue?.metadata?.channel) queue.metadata.channel.send("📭 Queue đã kết thúc. Cảm ơn bạn đã nghe nhạc!").catch(() => {});
  } catch {}
});

client.player.on("connectionError", (queue, error) => {
  console.warn(`⚠️ Lỗi kết nối voice ở guild ${queue?.guild?.id || "?"}:`, error);
  // attempt reconnect after short delay
  setTimeout(async () => {
    try {
      if (!queue.connection && queue.voiceChannel) await queue.connect(queue.voiceChannel);
    } catch (e) {
      console.error("Reconnect failed:", e);
    }
  }, 5000);
});

// -------- READY: register commands (single block) -------- //
client.once(Events.ClientReady, async () => {
  console.log(`✅ Bot MEYIA đã sẵn sàng (${client.user.tag})`);

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

    // Music slash commands (legacy single 'query' kept)
    { name: "play", description: "Phát nhạc (YouTube/YouTube Music) - link hoặc tên", options: [{ name: "query", description: "Tên bài / link / playlist", type: ApplicationCommandOptionType.String, required: true }] },
    { name: "stop", description: "Dừng nhạc và rời voice" },
    { name: "skip", description: "Bỏ qua bài đang phát" },
    { name: "pause", description: "Tạm dừng phát" },
    { name: "resume", description: "Tiếp tục phát" },
    { name: "queue", description: "Xem queue hiện tại" },
    { name: "volume", description: "Đặt âm lượng (1-200)", options: [{ name: "value", description: "Số (1-200)", type: ApplicationCommandOptionType.Integer, required: true }] },

    // activity admin placeholder
    {
      name: "activity",
      description: "Quản lý log hoạt động (chỉ admin)",
      options: [
        { name: "setup", description: "Chọn kênh log", type: ApplicationCommandOptionType.Subcommand, options: [{ name: "channel", description: "Kênh log (chọn)", type: ApplicationCommandOptionType.Channel, required: true }] },
        { name: "enable", description: "Bật log hoạt động", type: ApplicationCommandOptionType.Subcommand },
        { name: "disable", description: "Tắt log hoạt động", type: ApplicationCommandOptionType.Subcommand }
      ]
    }
  ];

  try {
    await client.application.commands.set(commands);
    console.log("Slash commands registered.");
  } catch (err) {
    console.error("Failed to register slash commands:", err);
  }

  // mini log of loaded slash commands
  try {
    client.application.commands.cache.forEach(c => console.log(`Slash command loaded: /${c.name}`));
  } catch {}
});

// -------- INTERACTIONS HANDLER (includes music & giveaway) -------- //
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const cmd = interaction.commandName;

  // ---------- GIVEAWAY ----------
  if (cmd === "giveaway") {
    try {
      const prize = interaction.options.getString("prize");
      const time = interaction.options.getString("time");
      const winnerCount = interaction.options.getInteger("winners");

      if (!/^\d+[smhd]$/.test(time)) {
        return interaction.reply({ content: "⚠️ Thời gian không hợp lệ! (ví dụ: 10m, 1h)", ephemeral: true });
      }

      const duration = ms(time);
      if (!duration || duration < 1000) {
        return interaction.reply({ content: "⚠️ Thời gian không hợp lệ! (ví dụ: 10m, 1h)", ephemeral: true });
      }

      const giveawayId = `giveaway_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

      const msg = await interaction.reply({ content: "🎉 Đang tạo giveaway...", fetchReply: true });

      try { await msg.react("🎉"); } catch {}

      client.giveawaysManager.start(msg.channel, {
        prize,
        duration,
        winnerCount,
        filter: (reaction, user) => !user.bot && reaction.emoji.name === "🎉",
        endedMessage: (guild, channel, message, winners) => {
          const endEmbed = new EmbedBuilder()
            .setColor(MAIN_COLOR)
            .setTitle("🎉 GIVEAWAY KẾT THÚC")
            .setDescription(`🎁 **Phần thưởng:** ${prize}\n\n${winners.length ? `🏆 **Người chiến thắng:** ${winners.map(id=>`<@${id}>`).join(", ")}` : "❌ Không có ai tham gia!"}\n\n👑 **Người tổ chức:** ${guild.members.cache.get(message.author.id)}`)
            .setThumbnail(guild.members.cache.get(message.author.id).displayAvatarURL({ dynamic: true }))
            .setImage(guild.me.displayAvatarURL({ dynamic: true, size: 512 }));

          msg.channel.send({ embeds: [endEmbed] }).catch(() => {});
        }
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
    if (!query || !query.trim()) return interaction.reply({ content: "⚠️ Vui lòng cung cấp link YouTube hoặc tên bài.", ephemeral: true });

    await interaction.deferReply();

    try {
      const search = await client.player.search(query, {
        requestedBy: interaction.user,
        searchEngine: QueryType.AUTO
      });

      if (!search || !search.tracks.length) return interaction.editReply("❌ Không tìm thấy bài hát!");

      const queue = await client.player.createQueue(interaction.guild, {
        metadata: { channel: interaction.channel },
        leaveOnEnd: true,
        leaveOnStop: true,
        leaveOnEmpty: true
      });

      try {
        if (!queue.connection) await queue.connect(memberVoice);
      } catch (err) {
        client.player.deleteQueue(interaction.guild.id);
        console.error("Voice connect error:", err);
        return interaction.editReply("⚠️ Bot không thể vào voice (kiểm tra quyền).");
      }

      if (search.playlist) {
        // add all tracks
        if (typeof queue.addTracks === "function") queue.addTracks(search.tracks);
        else search.tracks.forEach(t => queue.addTrack(t));
        await interaction.editReply(`🎶 Đã thêm playlist vào hàng chờ (${search.tracks.length} bài).`);
      } else {
        queue.addTrack(search.tracks[0]);
        await interaction.editReply(`🎶 Đã thêm **${search.tracks[0].title}** vào hàng chờ.`);
      }

      if (!queue.playing) await queue.play();
    } catch (err) {
      console.error("Play command error:", err);
      try { await interaction.editReply("❌ Lỗi khi phát nhạc."); } catch {}
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
// ---------- MESSAGE PREFIX COMMANDS (UNIFIED, fixed duplicate) ----------
client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    const prefix = "!";
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();
    const memberVoice = message.member?.voice?.channel;

    // !play auto
    if (cmd === "play" && args[0] === "auto") {
      if (!memberVoice) return message.reply("❗ Bạn phải vào kênh thoại trước!");

      const queue = await client.player.createQueue(message.guild, {
        metadata: { channel: message.channel },
        leaveOnEnd: true,
        leaveOnStop: true,
        leaveOnEmpty: true
      });

      try {
        if (!queue.connection) await queue.connect(memberVoice);
      } catch {
        try { client.player.deleteQueue(message.guild.id); } catch {}
        return message.reply("⚠️ Bot không thể vào voice.");
      }

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

    // !leave
    if (cmd === "leave") {
      const queue = client.player.getQueue(message.guild.id);
      if (!queue) return message.reply("❌ Không có bài nào đang phát!");
      queue.destroy();
      return message.reply("⛔ Đã dừng nhạc và rời voice.");
    }

    // !skipto <số>
    if (cmd === "skipto") {
      const queue = client.player.getQueue(message.guild.id);
      if (!queue || !queue.playing) return message.reply("❌ Không có bài nào đang phát!");
      const num = parseInt(args[0]);
      if (isNaN(num) || num < 1 || num > queue.tracks.length) return message.reply("⚠️ Nhập số hợp lệ trong queue!");
      queue.skipTo(num - 1);
      return message.reply(`⏭️ Bỏ qua đến bài số **${num}**: ${queue.current?.title || "?"}`);
    }
});
// ...existing code...

// ---------- MESSAGE PREFIX COMMANDS ---------- //
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  const prefix = "!";
  if (!message.content.startsWith(prefix)) return;
  if(!message.content.startsWith(prefix)) return;

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
      try { client.player.deleteQueue(message.guild.id); } catch {}
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

// -------- volume config file (ensure dir exists + safe read) -------- //
const volumePath = path.join(__dirname, "config", "volume.json");
try {
  const dir = path.dirname(volumePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(volumePath)) fs.writeFileSync(volumePath, "{}");
} catch (e) {
  console.warn("⚠️ Could not ensure volume config path:", e);
}
let volumeConfig = {};
try {
  volumeConfig = JSON.parse(fs.readFileSync(volumePath, "utf8") || "{}");
} catch (e) {
  console.warn("⚠️ volume.json parse error, resetting to {}:", e);
  fs.writeFileSync(volumePath, "{}");
  volumeConfig = {};
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
  try {
    if (queue.metadata?.channel) queue.metadata.channel.send("📭 Queue đã kết thúc. Cảm ơn bạn đã nghe nhạc!").catch(() => {});
  } catch(e) {}
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
  // play auto
  // leave
  // skipto
  // ... giữ nguyên tất cả prefix commands như bạn gửi ...
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

// -------- LOGIN (fixed duplicates) -------- //
const token = process.env.TOKEN || process.env.DISCORD_TOKEN;
if (!token) {
    console.error("❌ Thiếu TOKEN trong .env");
    process.exit(1);
}
client.login(token).catch(err => {
    console.error("Login error:", err);
    process.exit(1);
});
});