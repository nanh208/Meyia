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
const playdl = require("play-dl"); 
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
    GatewayIntentBits.GuildVoiceStates
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

// -------- SETUP play-dl (YouTube Music cookie) -------- //
if (process.env.YOUTUBE_COOKIE) {
  try {
    playdl.setToken({ ytmusic: process.env.YOUTUBE_COOKIE });
  } catch (err) {
    console.warn("⚠️ play-dl cookie setup warning:", err?.message || err);
  }
}

// -------- PLAYER INIT -------- //
client.player = new Player(client, {
  ytdlOptions: {
    quality: "highestaudio",
    highWaterMark: 1 << 25
  }
});

// Player events
client.player.on("error", (queue, error) => console.error(`Player Error in guild ${queue.guild.id}:`, error));
client.player.on("playerStart", (queue, track) => {
  if (queue.metadata?.channel) {
    try {
      queue.metadata.channel.send({ content: `🎶 Đang phát: **${track.title}** — yêu cầu bởi <@${track.requestedBy?.id || "?"}>` }).catch(() => {});
    } catch {}
  }
});
client.player.on("playerDisconnect", (queue) => {
  if (queue.metadata?.channel) {
    try { queue.metadata.channel.send("📛 Bot đã rời voice, queue đã bị huỷ.").catch(()=>{}); } catch{}
  }
});

// -------- READY & REGISTER SLASH COMMANDS -------- //
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

    // Music
    { name: "play", description: "Phát nhạc (YouTube Music / YouTube)", options: [{ name: "query", description: "Tên bài / link / playlist", type: ApplicationCommandOptionType.String, required: true }] },
    { name: "stop", description: "Dừng nhạc và rời voice" },
    { name: "skip", description: "Bỏ qua bài đang phát" },
    { name: "pause", description: "Tạm dừng phát" },
    { name: "resume", description: "Tiếp tục phát" },
    { name: "queue", description: "Xem queue hiện tại" },
    { name: "volume", description: "Đặt âm lượng (1-200)", options: [{ name: "value", description: "Số (1-200)", type: ApplicationCommandOptionType.Integer, required: true }] },

    // Activity
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
    console.log("✅ Slash commands đã đăng ký.");
  } catch (err) {
    console.error("❌ Lỗi khi đăng ký slash commands:", err);
  }
});

// -------- INTERACTIONS HANDLER (includes music & giveaway) -------- //
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const cmd = interaction.commandName;

  // =================== GIVEAWAY ===================
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
          try { return reaction.emoji.id === "1261960933270618192" && !u.bot; } catch(e){ return false; }
        },
        time: duration
      });

      collector.on("collect", (_, u) => participants.add(u.id));
      collector.on("end", async () => {
        let winners = [];
        if (participants.size === 0) { winners = []; } 
        else {
          const arr = Array.from(participants);
          for (let i=0; i<winnerCount && arr.length>0; i++){
            const idx = Math.floor(Math.random()*arr.length);
            winners.push(arr.splice(idx,1)[0]);
          }
        }

        const endEmbed = new EmbedBuilder()
          .setColor(MAIN_COLOR)
          .setTitle(`<a:1255341894687260775:1433317867293642858> GIVEAWAY KẾT THÚC <a:1255340646248616061:1433286685189341204>`)
          .setDescription(
            `🎁 **Phần thưởng:** ${prize}\n\n` +
            `${winners.length ? `🏆 **Người chiến thắng:** ${winners.map(id=>`<@${id}>`).join(", ")}` : "❌ Không có ai tham gia!"}\n\n` +
            `👑 **Người tổ chức:** ${interaction.user}\n📛 **Mã giveaway:** ${giveawayId}`
          )
          .setThumbnail(interaction.user.displayAvatarURL({ dynamic:true }))
          .setImage(interaction.client.user.displayAvatarURL({ dynamic:true, size:512 }));

        await msg.edit({ embeds: [endEmbed] });
        if (winners.length>0) interaction.channel.send(`🎊 Chúc mừng ${winners.map(id=>`<@${id}>`).join(", ")} đã thắng **${prize}**!`);
      });

      return interaction.reply({ content: "✅ Giveaway đã được tạo thành công!", ephemeral: true });
    } catch(err) {
      console.error("Giveaway error:", err);
      return interaction.reply({ content: "❌ Lỗi khi tạo giveaway.", ephemeral: true });
    }
  }

// =================== MUSIC COMMANDS =================== //
if (cmd === "play") {
  const query = interaction.options.getString("query");
  const voice = interaction.member.voice.channel;

  if (!voice)
    return interaction.reply({ content: "❌ Bạn cần vào kênh voice trước!", ephemeral: true });

  try {
    const result = await client.player.search(query, {
      requestedBy: interaction.user,
      searchEngine: QueryType.AUTO
    });

    if (!result || !result.tracks.length)
      return interaction.reply({ content: "😢 Không tìm thấy bài nào.", ephemeral: true });

    const queue = await client.player.nodes.create(interaction.guild, {
      metadata: { channel: interaction.channel },
      leaveOnEmpty: true,
      leaveOnEnd: true,
      leaveOnStop: true
    });

    if (!queue.connection) await queue.connect(voice);
    result.playlist ? queue.addTrack(result.tracks) : queue.addTrack(result.tracks[0]);
    if (!queue.node.isPlaying()) await queue.node.play();

    return interaction.reply({
      content: `🎶 Đã thêm **${result.tracks[0].title}** vào hàng chờ.`
    });
  } catch (err) {
    console.error(err);
    return interaction.reply({ content: "❌ Lỗi khi phát nhạc!", ephemeral: true });
  }
}

if (cmd === "stop") {
  const queue = client.player.nodes.get(interaction.guild.id);
  if (!queue) return interaction.reply({ content: "❌ Không có bài nào đang phát.", ephemeral: true });
  queue.delete();
  return interaction.reply("🛑 Dừng nhạc và rời voice.");
}

if (cmd === "skip") {
  const queue = client.player.nodes.get(interaction.guild.id);
  if (!queue || !queue.node.isPlaying())
    return interaction.reply({ content: "❌ Không có bài nào đang phát.", ephemeral: true });
  await queue.node.skip();
  return interaction.reply("⏭️ Đã bỏ qua bài hiện tại.");
}

if (cmd === "pause") {
  const queue = client.player.nodes.get(interaction.guild.id);
  if (!queue || !queue.node.isPlaying())
    return interaction.reply({ content: "❌ Không có bài nào đang phát.", ephemeral: true });
  queue.node.pause();
  return interaction.reply("⏸️ Đã tạm dừng phát nhạc.");
}

if (cmd === "resume") {
  const queue = client.player.nodes.get(interaction.guild.id);
  if (!queue)
    return interaction.reply({ content: "❌ Không có queue nào đang hoạt động.", ephemeral: true });
  queue.node.resume();
  return interaction.reply("▶️ Tiếp tục phát nhạc.");
}

if (cmd === "queue") {
  const queue = client.player.nodes.get(interaction.guild.id);
  if (!queue || !queue.tracks || queue.tracks.data.length === 0)
    return interaction.reply({ content: "📭 Queue đang trống." });

  const tracks = queue.tracks.data
    .slice(0, 10)
    .map((track, i) => `${i + 1}. [${track.title}](${track.url}) — <@${track.requestedBy?.id || "?"}>`)
    .join("\n");

  const embed = new EmbedBuilder()
    .setColor(MAIN_COLOR)
    .setTitle("🎶 Hàng chờ hiện tại:")
    .setDescription(tracks)
    .setFooter({ text: queue.tracks.data.length > 10 ? `...và ${queue.tracks.data.length - 10} bài khác` : "Hết" });

  return interaction.reply({ embeds: [embed] });
}

if (cmd === "volume") {
  const value = interaction.options.getInteger("value");
  if (isNaN(value) || value < 1 || value > 200)
    return interaction.reply({ content: "⚠️ Nhập số từ 1 đến 200!", ephemeral: true });

  const queue = client.player.nodes.get(interaction.guild.id);
  if (!queue)
    return interaction.reply({ content: "❌ Không có bài nào đang phát.", ephemeral: true });

  queue.node.setVolume(value);
  return interaction.reply(`🔊 Âm lượng đã đặt là **${value}%**`);
}

  // =================== FUN & UTIL ===================
  // ping, love, rps, 8ball, mood, quote, say, avatar, xoachat
  // ... giữ nguyên code gốc của bạn ...

  // =================== ACTIVITY ===================
  // activity subcommands
  // ... giữ nguyên code gốc của bạn ...

  // =================== HELP & STATUS ===================
  // help, status, info
  // ... giữ nguyên code gốc của bạn ...

});

// =================== PREFIX COMMANDS ===================
client.on("messageCreate", async (message)=>{
  if(message.author.bot) return;
  const prefix = "!";
  if(!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  const memberVoice = message.member?.voice?.channel;

  // play auto
  // leave
  // skipto
  // ... giữ nguyên tất cả prefix commands như bạn gửi ...
});

// =================== IMPROVEMENTS ===================
// volume.json
// auto reconnect
// queueEnd
// log slash command
// giữ nguyên như phiên bản trước của bạn

// -------- LOGIN -------- //
const token = process.env.TOKEN || process.env.DISCORD_TOKEN;
if(!token){
  console.error("❌ Thiếu TOKEN trong .env");
  process.exit(1);
} else {
  client.login(token).catch(err=>{
    console.error("Login error:", err);
    process.exit(1);
  });
}
