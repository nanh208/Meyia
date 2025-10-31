// index.js — Meiya (Slash + SQLite) — NO MUSIC (updated: help + giveaway + fun)
require("dotenv").config();
const { Client, GatewayIntentBits, Partials, Events, EmbedBuilder, PermissionsBitField, ApplicationCommandOptionType } = require("discord.js");
const path = require("path");
const fs = require("fs");
const ms = require("ms");
const Database = require("better-sqlite3");
const fetch = require("node-fetch");

const MAIN_COLOR = "#FFB6C1";
const OWNER_ID = process.env.OWNER_ID || "0";

// ensure database dir
const dbDir = path.join(__dirname, "database");
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
const dbPath = path.join(dbDir, "data.db");
const db = new Database(dbPath);

// create tables
db.prepare(`CREATE TABLE IF NOT EXISTS warnings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guildId TEXT,
  userId TEXT,
  moderatorId TEXT,
  reason TEXT,
  timestamp INTEGER
)`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guildId TEXT,
  userId TEXT,
  remindAt INTEGER,
  message TEXT,
  createdAt INTEGER
)`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS guild_config (
  guildId TEXT PRIMARY KEY,
  logChannelId TEXT,
  autoRoleId TEXT
)`).run();
db.prepare(`CREATE TABLE IF NOT EXISTS giveaways (
  id TEXT PRIMARY KEY,
  channel_id TEXT,
  message_id TEXT,
  prize TEXT,
  winners INTEGER,
  end_time INTEGER,
  host_id TEXT,
  ended INTEGER DEFAULT 0
)`).run();

module.exports = {
  data: new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("🎁 Tạo một sự kiện giveaway mới")
    .addStringOption(o => o.setName("phần_thưởng").setDescription("Phần thưởng là gì?").setRequired(true))
    .addIntegerOption(o => o.setName("số_lượng_giải").setDescription("Số người thắng").setRequired(true))
    .addStringOption(o => o.setName("thời_gian").setDescription("Thời gian (vd: 10m, 1h, 1d)").setRequired(true)),

  async execute(interaction) {
    try {
      const prize = interaction.options.getString("phần_thưởng");
      const numWinners = interaction.options.getInteger("số_lượng_giải");
      const time = parseTime(interaction.options.getString("thời_gian"));
      if (!time) return interaction.reply({ content: "❌ Thời gian không hợp lệ!", ephemeral: true });

      const endTime = Date.now() + time;

      const embed = new EmbedBuilder()
        .setColor(MAIN_COLOR)
        .setTitle("<a:1255341894687260775:1433317867293642858> **GIVEAWAY** <a:1255340646248616061:1433317989406605383>")
        .setDescription(
          `🎁 **Phần thưởng:** ${prize}\n` +
          `<a:1255340646248616061:1433317989406605383> **Số lượng giải:** ${numWinners}\n` +
          `⌛ **Thời gian:** ${interaction.options.getString("thời_gian")}\n` +
          `👑 **Người tổ chức:** <@${interaction.user.id}>`
        )
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: "Nhấn 🎉 để tham gia!", iconURL: interaction.client.user.displayAvatarURL() });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("join_giveaway")
          .setLabel("🎉 Tham Gia")
          .setStyle(ButtonStyle.Success)
      );

      const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

      db.prepare("INSERT INTO giveaways (id, channel_id, message_id, prize, winners, end_time, host_id) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(msg.id, interaction.channel.id, msg.id, prize, numWinners, endTime, interaction.user.id);

      scheduleGiveaway(interaction.client, msg, endTime, numWinners, prize, interaction);
    } catch (err) {
      console.error("Giveaway error:", err);
      return interaction.reply({ content: "❌ Có lỗi xảy ra khi tạo giveaway.", ephemeral: true });
    }
  },
};

// === Hỗ trợ ===
function parseTime(str) {
  const m = /^(\d+)([smhd])$/.exec(str);
  if (!m) return null;
  const map = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return parseInt(m[1]) * map[m[2]];
}

function scheduleGiveaway(client, msg, endTime, numWinners, prize, interaction) {
  const giveawayId = msg.id;

  const interval = setInterval(async () => {
    if (Date.now() >= endTime) {
      clearInterval(interval);
      const data = db.prepare("SELECT * FROM giveaways WHERE id=? AND ended=0").get(giveawayId);
      if (!data) return;

      db.prepare("UPDATE giveaways SET ended=1 WHERE id=?").run(giveawayId);

      const channel = await client.channels.fetch(data.channel_id);
      const message = await channel.messages.fetch(data.message_id);
      const reactions = await message.reactions.resolve("🎉")?.users.fetch() ?? new Map();
      const participants = Array.from(reactions.keys()).filter(id => id !== client.user.id);

      const winners = participants.sort(() => 0.5 - Math.random()).slice(0, numWinners);

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

      await message.edit({ embeds: [endEmbed], components: [] });

      if (winners.length > 0)
        channel.send(`🎊 Chúc mừng ${winners.map(id => `<@${id}>`).join(", ")} đã thắng **${prize}**!`);
    }
  }, 5000);
}
// helpers for db
const insertWarning = db.prepare(`INSERT INTO warnings (guildId, userId, moderatorId, reason, timestamp) VALUES (?, ?, ?, ?, ?)`);
const getWarnings = db.prepare(`SELECT * FROM warnings WHERE guildId = ? AND userId = ? ORDER BY id DESC`);
const deleteWarnings = db.prepare(`DELETE FROM warnings WHERE guildId = ? AND userId = ?`);
const getAllWarnings = db.prepare(`SELECT * FROM warnings WHERE guildId = ? ORDER BY id DESC`);

const insertReminder = db.prepare(`INSERT INTO reminders (guildId, userId, remindAt, message, createdAt) VALUES (?, ?, ?, ?, ?)`);
const getPendingReminders = db.prepare(`SELECT * FROM reminders WHERE remindAt > ? ORDER BY remindAt ASC`);
const deleteReminder = db.prepare(`DELETE FROM reminders WHERE id = ?`);

const setGuildConfig = db.prepare(`INSERT INTO guild_config (guildId, logChannelId, autoRoleId) VALUES (?, ?, ?) 
  ON CONFLICT(guildId) DO UPDATE SET logChannelId=excluded.logChannelId, autoRoleId=excluded.autoRoleId`);
const getGuildConfig = db.prepare(`SELECT * FROM guild_config WHERE guildId = ?`);

// client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction]
});

// utility
function isAdmin(member) {
  try {
    return member.permissions.has(PermissionsBitField.Flags.Administrator) || member.id === OWNER_ID;
  } catch { return false; }
}

function ensureMuteRole(guild) {
  const roleName = "Meiya Muted";
  let role = guild.roles.cache.find(r => r.name === roleName);
  return role;
}

// register commands list (including giveaway + help + small fun commands)
const commands = [
  // Moderation
  { name: "ban", description: "Ban member", options: [{ name: "user", type: ApplicationCommandOptionType.User, required: true }, { name: "reason", type: ApplicationCommandOptionType.String, required: false }] },
  { name: "kick", description: "Kick member", options: [{ name: "user", type: ApplicationCommandOptionType.User, required: true }, { name: "reason", type: ApplicationCommandOptionType.String, required: false }] },
  { name: "unban", description: "Unban by user ID", options: [{ name: "userid", type: ApplicationCommandOptionType.String, required: true }] },
  { name: "timeout", description: "Timeout (in minutes)", options: [{ name: "user", type: ApplicationCommandOptionType.User, required: true }, { name: "minutes", type: ApplicationCommandOptionType.Integer, required: true }, { name: "reason", type: ApplicationCommandOptionType.String, required: false }] },
  { name: "clear", description: "Bulk delete messages (1-100)", options: [{ name: "amount", type: ApplicationCommandOptionType.Integer, required: true }] },
  { name: "lock", description: "Lock the current channel" },
  { name: "unlock", description: "Unlock the current channel" },
  { name: "mute", description: "Mute member (role-based or timeout)", options: [{ name: "user", type: ApplicationCommandOptionType.User, required: true }, { name: "minutes", type: ApplicationCommandOptionType.Integer, required: false }] },
  { name: "unmute", description: "Unmute member", options: [{ name: "user", type: ApplicationCommandOptionType.User, required: true }] },

  // Warn
  { name: "warn", description: "Warn a user (saved)", options: [{ name: "user", type: ApplicationCommandOptionType.User, required: true }, { name: "reason", type: ApplicationCommandOptionType.String, required: true }] },
  { name: "warnings", description: "List warnings for a user", options: [{ name: "user", type: ApplicationCommandOptionType.User, required: true }] },
  { name: "clearwarn", description: "Clear warnings for a user", options: [{ name: "user", type: ApplicationCommandOptionType.User, required: true }] },
  { name: "setlog", description: "Set mod log channel", options: [{ name: "channel", type: ApplicationCommandOptionType.Channel, required: true }] },

  // Utility/Info
  { name: "help", description: "Show help and usage for commands" },
  { name: "serverinfo", description: "Show server info" },
  { name: "userinfo", description: "Show user info", options: [{ name: "user", type: ApplicationCommandOptionType.User, required: false }] },
  { name: "avatar", description: "Show avatar", options: [{ name: "user", type: ApplicationCommandOptionType.User, required: false }] },
  { name: "ping", description: "Check bot latency" },
  { name: "uptime", description: "Show bot uptime" },
  { name: "botinfo", description: "Info about the bot" },
  { name: "say", description: "Bot says your message", options: [{ name: "text", type: ApplicationCommandOptionType.String, required: true }] },
  { name: "embed", description: "Send embed", options: [{ name: "title", type: ApplicationCommandOptionType.String, required: true }, { name: "description", type: ApplicationCommandOptionType.String, required: true }] },
  { name: "poll", description: "Create poll", options: [{ name: "question", type: ApplicationCommandOptionType.String, required: true }, { name: "option1", type: ApplicationCommandOptionType.String, required: true }, { name: "option2", type: ApplicationCommandOptionType.String, required: true }, { name: "option3", type: ApplicationCommandOptionType.String, required: false }, { name: "option4", type: ApplicationCommandOptionType.String, required: false }] },

  // Reminders / advanced utils
  { name: "remind", description: "Set a reminder (e.g. 10m, 2h, 1d)", options: [{ name: "time", type: ApplicationCommandOptionType.String, required: true }, { name: "text", type: ApplicationCommandOptionType.String, required: true }] },
  { name: "roleinfo", description: "Role details", options: [{ name: "role", type: ApplicationCommandOptionType.Role, required: true }] },

  // Fun + Misc
  { name: "quote", description: "Random quote" },
  { name: "coinflip", description: "Toss a coin" },
  { name: "dice", description: "Roll a dice (1-6)" },
  { name: "8ball", description: "Magic 8-ball answer", options: [{ name: "question", type: ApplicationCommandOptionType.String, required: true }] },
  { name: "meme", description: "Random meme (reddit)" },

  // Giveaway
  { name: "giveaway", description: "Create a giveaway (time: 10m, 1h, 1d)", options: [{ name: "time", type: ApplicationCommandOptionType.String, required: true }, { name: "winners", type: ApplicationCommandOptionType.Integer, required: true }, { name: "prize", type: ApplicationCommandOptionType.String, required: true }] },

  // DB/Stats
  { name: "stats", description: "Show bot stats" },
  { name: "dbstatus", description: "Show database file status" },
  { name: "warnlog", description: "Show recent warn logs (server)", options: [] }
];

// on ready
client.once(Events.ClientReady, async () => {
  console.log(`✅ Meiya ready as ${client.user.tag}`);

  try {
    await client.application.commands.set(commands);
    console.log("Slash commands deployed.");
  } catch (e) {
    console.error("Failed to deploy commands:", e);
  }

  // Load reminders from DB and schedule them
  const now = Date.now();
  const rows = getPendingReminders.all(now);
  for (const r of rows) {
    scheduleReminder(r);
  }
});

// schedule reminder helper
function scheduleReminder(row) {
  const delay = row.remindAt - Date.now();
  if (delay <= 0) {
    deliverReminder(row).catch(console.error);
    return;
  }
  setTimeout(async () => {
    await deliverReminder(row);
  }, delay);
}

async function deliverReminder(row) {
  try {
    const user = await client.users.fetch(row.userId).catch(() => null);
    if (user) {
      user.send(`🔔 Reminder: ${row.message}`).catch(() => {});
    }
    deleteReminder.run(row.id);
  } catch (e) {
    console.error("deliverReminder error:", e);
  }
}

// interaction handler
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (!interaction.isChatInputCommand()) return;
    const cmd = interaction.commandName;

    // ---------- MODERATION ----------
    if (cmd === "ban") {
      if (!isAdmin(interaction.member)) return interaction.reply({ content: "🚫 Bạn không có quyền.", ephemeral: true });
      const user = interaction.options.getUser("user");
      const reason = interaction.options.getString("reason") || "Không có lý do";
      const member = interaction.guild.members.cache.get(user.id);
      if (!member) return interaction.reply({ content: "Người dùng không nằm trong server.", ephemeral: true });
      if (!member.bannable) return interaction.reply({ content: "Không thể ban người này (role cao hơn?).", ephemeral: true });
      await member.ban({ reason }).catch(err => { throw err; });
      interaction.reply({ content: `✅ Đã banned **${user.tag}**. Lý do: ${reason}` });
      logToChannel(interaction.guild.id, `🔨 **Ban**: ${user.tag}\nModerator: ${interaction.user.tag}\nReason: ${reason}`);
      return;
    }

    if (cmd === "kick") {
      if (!isAdmin(interaction.member)) return interaction.reply({ content: "🚫 Bạn không có quyền.", ephemeral: true });
      const user = interaction.options.getUser("user");
      const reason = interaction.options.getString("reason") || "Không có lý do";
      const member = interaction.guild.members.cache.get(user.id);
      if (!member) return interaction.reply({ content: "Người dùng không nằm trong server.", ephemeral: true });
      if (!member.kickable) return interaction.reply({ content: "Không thể kick người này.", ephemeral: true });
      await member.kick(reason).catch(err => { throw err; });
      interaction.reply({ content: `✅ Đã kick **${user.tag}**. Lý do: ${reason}` });
      logToChannel(interaction.guild.id, `👢 **Kick**: ${user.tag}\nModerator: ${interaction.user.tag}\nReason: ${reason}`);
      return;
    }

    if (cmd === "unban") {
      if (!isAdmin(interaction.member)) return interaction.reply({ content: "🚫 Bạn không có quyền.", ephemeral: true });
      const id = interaction.options.getString("userid");
      try {
        await interaction.guild.bans.remove(id);
        interaction.reply({ content: `✅ Đã unban ID ${id}` });
        logToChannel(interaction.guild.id, `♻️ **Unban**: ${id}\nModerator: ${interaction.user.tag}`);
      } catch (e) {
        interaction.reply({ content: `❌ Không thể unban ID ${id} — có thể không tồn tại.` , ephemeral: true});
      }
      return;
    }

    if (cmd === "timeout") {
      if (!isAdmin(interaction.member)) return interaction.reply({ content: "🚫 Bạn không có quyền.", ephemeral: true });
      const user = interaction.options.getUser("user");
      const minutes = interaction.options.getInteger("minutes");
      const reason = interaction.options.getString("reason") || "Không có lý do";
      const member = interaction.guild.members.cache.get(user.id);
      if (!member) return interaction.reply({ content: "Người dùng không nằm trong server.", ephemeral: true });
      const msTimeout = minutes * 60 * 1000;
      await member.timeout(msTimeout, reason).catch(err => { throw err; });
      interaction.reply({ content: `⏱️ Đã timeout **${user.tag}** trong ${minutes} phút. Lý do: ${reason}` });
      logToChannel(interaction.guild.id, `⏱️ **Timeout**: ${user.tag}\nModerator: ${interaction.user.tag}\nDuration: ${minutes}m\nReason: ${reason}`);
      return;
    }

    if (cmd === "clear") {
      if (!isAdmin(interaction.member)) return interaction.reply({ content: "🚫 Bạn không có quyền.", ephemeral: true });
      const amount = interaction.options.getInteger("amount");
      if (amount < 1 || amount > 100) return interaction.reply({ content: "⚠️ Số phải trong 1–100.", ephemeral: true });
      const channel = interaction.channel;
      const fetched = await channel.bulkDelete(amount, true).catch(err => { return null; });
      if (!fetched) return interaction.reply({ content: "❌ Không thể xóa (tin quá cũ?).", ephemeral: true });
      interaction.reply({ content: `🧹 Đã xóa ${fetched.size} tin nhắn.` });
      logToChannel(interaction.guild.id, `🧹 **Bulk Delete**: ${fetched.size} messages by ${interaction.user.tag} in #${channel.name}`);
      return;
    }

    if (cmd === "lock") {
      if (!isAdmin(interaction.member)) return interaction.reply({ content: "🚫 Bạn không có quyền.", ephemeral: true });
      const ch = interaction.channel;
      await ch.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false }).catch(e => { throw e; });
      interaction.reply({ content: `🔒 Đã khóa kênh ${ch}.` });
      logToChannel(interaction.guild.id, `🔒 Channel locked: #${ch.name} by ${interaction.user.tag}`);
      return;
    }

    if (cmd === "unlock") {
      if (!isAdmin(interaction.member)) return interaction.reply({ content: "🚫 Bạn không có quyền.", ephemeral: true });
      const ch = interaction.channel;
      await ch.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: null }).catch(e => { throw e; });
      interaction.reply({ content: `🔓 Đã mở khóa kênh ${ch}.` });
      logToChannel(interaction.guild.id, `🔓 Channel unlocked: #${ch.name} by ${interaction.user.tag}`);
      return;
    }

    if (cmd === "mute") {
      if (!isAdmin(interaction.member)) return interaction.reply({ content: "🚫 Bạn không có quyền.", ephemeral: true });
      const user = interaction.options.getUser("user");
      const minutes = interaction.options.getInteger("minutes") || 0;
      const member = interaction.guild.members.cache.get(user.id);
      if (!member) return interaction.reply({ content: "Người dùng không nằm trong server.", ephemeral: true });

      if (minutes > 0) {
        await member.timeout(minutes * 60 * 1000, `Muted by ${interaction.user.tag}`).catch(() => {});
        interaction.reply({ content: `🔇 Đã tạm mute ${user.tag} trong ${minutes} phút (timeout).` });
      } else {
        let role = interaction.guild.roles.cache.find(r => r.name === "Meiya Muted");
        if (!role) {
          role = await interaction.guild.roles.create({ name: "Meiya Muted", permissions: [] });
          for (const ch of interaction.guild.channels.cache.values()) {
            try { await ch.permissionOverwrites.edit(role, { SendMessages: false, AddReactions: false, Speak: false }).catch(()=>{}); } catch {}
          }
        }
        await member.roles.add(role).catch(e => {});
        interaction.reply({ content: `🔇 Đã thêm role Muted cho ${user.tag}` });
      }
      logToChannel(interaction.guild.id, `🔇 Muted ${user.tag} by ${interaction.user.tag}`);
      return;
    }

    if (cmd === "unmute") {
      if (!isAdmin(interaction.member)) return interaction.reply({ content: "🚫 Bạn không có quyền.", ephemeral: true });
      const user = interaction.options.getUser("user");
      const member = interaction.guild.members.cache.get(user.id);
      if (!member) return interaction.reply({ content: "Người dùng không nằm trong server.", ephemeral: true });
      const role = interaction.guild.roles.cache.find(r => r.name === "Meiya Muted");
      if (role) { await member.roles.remove(role).catch(()=>{}); }
      await member.timeout(null).catch(()=>{});
      interaction.reply({ content: `🔊 Đã unmute ${user.tag}` });
      logToChannel(interaction.guild.id, `🔊 Unmuted ${user.tag} by ${interaction.user.tag}`);
      return;
    }

    // WARN system
    if (cmd === "warn") {
      if (!isAdmin(interaction.member)) return interaction.reply({ content: "🚫 Bạn không có quyền.", ephemeral: true });
      const target = interaction.options.getUser("user");
      const reason = interaction.options.getString("reason");
      insertWarning.run(interaction.guild.id, target.id, interaction.user.id, reason, Date.now());
      interaction.reply({ content: `⚠️ Đã warn **${target.tag}**. Lý do: ${reason}` });
      logToChannel(interaction.guild.id, `⚠️ Warn: ${target.tag}\nModerator: ${interaction.user.tag}\nReason: ${reason}`);
      return;
    }

    if (cmd === "warnings") {
      const target = interaction.options.getUser("user");
      const rows = getWarnings.all(interaction.guild.id, target.id);
      if (!rows || !rows.length) return interaction.reply({ content: `✅ Không có warning cho ${target.tag}`, ephemeral: true });
      const desc = rows.slice(0,10).map(r => `• [${new Date(r.timestamp).toLocaleString()}] ${r.reason} (by <@${r.moderatorId}>)`).join("\n");
      const embed = new EmbedBuilder().setColor(MAIN_COLOR).setTitle(`Warnings for ${target.tag}`).setDescription(desc);
      return interaction.reply({ embeds: [embed] });
    }

    if (cmd === "clearwarn") {
      if (!isAdmin(interaction.member)) return interaction.reply({ content: "🚫 Bạn không có quyền.", ephemeral: true });
      const target = interaction.options.getUser("user");
      deleteWarnings.run(interaction.guild.id, target.id);
      interaction.reply({ content: `✅ Đã xóa warnings cho ${target.tag}` });
      logToChannel(interaction.guild.id, `🧾 Cleared warnings for ${target.tag} by ${interaction.user.tag}`);
      return;
    }

    if (cmd === "setlog") {
      if (!isAdmin(interaction.member)) return interaction.reply({ content: "🚫 Bạn không có quyền.", ephemeral: true });
      const channel = interaction.options.getChannel("channel");
      setGuildConfig.run(interaction.guild.id, channel.id, null);
      interaction.reply({ content: `✅ Đã đặt kênh log: <#${channel.id}>`, ephemeral: true });
      return;
    }

    // ---------- UTIL ----------
    if (cmd === "serverinfo") {
      const g = interaction.guild;
      const embed = new EmbedBuilder()
        .setTitle(`${g.name} — Server info`)
        .setColor(MAIN_COLOR)
        .addFields(
          { name: "ID", value: g.id, inline: true },
          { name: "Members", value: `${g.memberCount}`, inline: true },
          { name: "Roles", value: `${g.roles.cache.size}`, inline: true },
          { name: "Channels", value: `${g.channels.cache.size}`, inline: true },
          { name: "Created", value: `${g.createdAt.toDateString()}`, inline: true }
        )
      return interaction.reply({ embeds: [embed] });
    }

    if (cmd === "userinfo") {
      const user = interaction.options.getUser("user") || interaction.user;
      const member = interaction.guild.members.cache.get(user.id);
      const embed = new EmbedBuilder()
        .setTitle(`${user.tag} — Info`)
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .setColor(MAIN_COLOR)
        .addFields(
          { name: "ID", value: user.id, inline: true },
          { name: "Bot?", value: String(user.bot), inline: true },
          { name: "Joined server", value: member ? String(member.joinedAt) : "N/A", inline: true }
        );
      return interaction.reply({ embeds: [embed] });
    }

    if (cmd === "avatar") {
      const user = interaction.options.getUser("user") || interaction.user;
      const embed = new EmbedBuilder().setTitle(`${user.tag} — Avatar`).setImage(user.displayAvatarURL({ dynamic: true, size: 1024 })).setColor(MAIN_COLOR);
      return interaction.reply({ embeds: [embed] });
    }

    if (cmd === "ping") {
      return interaction.reply({ content: `🏓 Pong — WS: ${client.ws.ping}ms` });
    }

    if (cmd === "uptime") {
      const total = client.uptime || 0;
      const s = Math.floor(total/1000)%60;
      const m = Math.floor(total/1000/60)%60;
      const h = Math.floor(total/1000/60/60);
      return interaction.reply({ content: `⏱️ Uptime: ${h}h ${m}m ${s}s` });
    }

    if (cmd === "botinfo") {
      const mem = process.memoryUsage().rss / (1024*1024);
      const embed = new EmbedBuilder()
        .setTitle("Meiya Bot")
        .setColor(MAIN_COLOR)
        .addFields(
          { name: "Owner", value: `<@${OWNER_ID}>`, inline: true },
          { name: "Guilds", value: String(client.guilds.cache.size), inline: true },
          { name: "Memory (RSS)", value: `${Math.round(mem)} MB`, inline: true }
        );
      return interaction.reply({ embeds: [embed] });
    }

    if (cmd === "say") {
      const text = interaction.options.getString("text");
      await interaction.reply({ content: "✅ Sent (ephemeral)", ephemeral: true });
      interaction.channel.send({ content: text }).catch(()=>{});
      return;
    }

    if (cmd === "embed") {
      const title = interaction.options.getString("title");
      const desc = interaction.options.getString("description");
      const em = new EmbedBuilder().setTitle(title).setDescription(desc).setColor(MAIN_COLOR);
      await interaction.reply({ embeds: [em] });
      return;
    }

    if (cmd === "poll") {
      const q = interaction.options.getString("question");
      const o1 = interaction.options.getString("option1");
      const o2 = interaction.options.getString("option2");
      const o3 = interaction.options.getString("option3");
      const o4 = interaction.options.getString("option4");
      const options = [o1, o2].concat([o3, o4].filter(Boolean));
      const em = new EmbedBuilder().setTitle("📊 " + q).setDescription(options.map((o,i)=>`${i+1}. ${o}`).join("\n")).setColor(MAIN_COLOR);
      const msg = await interaction.reply({ embeds: [em], fetchReply: true });
      const emojis = ["1️⃣","2️⃣","3️⃣","4️⃣"];
      for (let i=0;i<options.length;i++) await msg.react(emojis[i]);
      return;
    }

    if (cmd === "roleinfo") {
      const role = interaction.options.getRole("role");
      const em = new EmbedBuilder().setTitle(`Role: ${role.name}`).setColor(MAIN_COLOR)
        .addFields(
          { name: "ID", value: role.id, inline: true },
          { name: "Members with role", value: `${role.members.size}`, inline: true },
          { name: "Position", value: String(role.position), inline: true }
        );
      return interaction.reply({ embeds: [em] });
    }

    if (cmd === "quote") {
      const quotes = ["✨ Hãy làm tốt hôm nay.", "🌸 Bạn làm được!", "💫 Mỗi ngày là cơ hội mới."];
      return interaction.reply(quotes[Math.floor(Math.random()*quotes.length)]);
    }

    // FUN small
    if (cmd === "coinflip") {
      return interaction.reply(Math.random() < 0.5 ? "🪙 Heads" : "🪙 Tails");
    }
    if (cmd === "dice") {
      return interaction.reply(`🎲 Bạn lắc được: ${Math.floor(Math.random()*6)+1}`);
    }
    if (cmd === "8ball") {
      const answers = ["Có", "Không", "Có thể", "Hỏi lại sau", "Chắc chắn có", "Rất ít khả năng"];
      return interaction.reply(answers[Math.floor(Math.random()*answers.length)]);
    }
    if (cmd === "meme") {
      try {
        const res = await fetch("https://www.reddit.com/r/memes/hot.json?limit=50").then(r=>r.json());
        const posts = res.data.children.filter(p => !p.data.over_18 && p.data.post_hint === "image");
        if (!posts.length) return interaction.reply("Không tìm thấy meme.");
        const pick = posts[Math.floor(Math.random()*posts.length)].data;
        const embed = new EmbedBuilder().setTitle(pick.title).setImage(pick.url).setColor(MAIN_COLOR).setFooter({ text: `r/${pick.subreddit}`});
        return interaction.reply({ embeds: [embed] });
      } catch (e) {
        return interaction.reply("❌ Lỗi khi lấy meme.");
      }
    }

    // REMINDERS
    if (cmd === "remind") {
      const timeStr = interaction.options.getString("time");
      const text = interaction.options.getString("text");
      let msTime = 0;
      try { msTime = ms(timeStr); } catch { msTime = 0; }
      if (!msTime) return interaction.reply({ content: "⏳ Không hiểu thời gian (ví dụ: 10m, 2h, 1d).", ephemeral: true });
      const remindAt = Date.now() + msTime;
      const createdAt = Date.now();
      const info = insertReminder.run(interaction.guild.id, interaction.user.id, remindAt, text, createdAt);
      const id = info.lastInsertRowid;
      scheduleReminder({ id, guildId: interaction.guild.id, userId: interaction.user.id, remindAt, message: text, createdAt });
      interaction.reply({ content: `🔔 Reminder đã đặt cho <t:${Math.floor(remindAt/1000)}:F>`, ephemeral: true });
      return;
    }

    // STATS / DB
    if (cmd === "stats") {
      const rows = db.prepare("SELECT COUNT(*) as c FROM warnings").get();
      const reminders = db.prepare("SELECT COUNT(*) as c FROM reminders").get();
      return interaction.reply({ content: `📊 Warnings: ${rows.c} — Reminders: ${reminders.c}` });
    }
    if (cmd === "dbstatus") {
      try {
        const stats = fs.statSync(dbPath);
        return interaction.reply({ content: `DB: ${dbPath}\nSize: ${Math.round(stats.size/1024)} KB\nModified: ${stats.mtime}` });
      } catch (e) {
        return interaction.reply({ content: `Không thể đọc DB: ${e.message}`, ephemeral: true });
      }
    }
    if (cmd === "warnlog") {
      const rows = getAllWarnings.all(interaction.guild.id);
      if (!rows || !rows.length) return interaction.reply({ content: "Không có logs cảnh cáo.", ephemeral: true });
      const desc = rows.slice(0,20).map(r => `• [${new Date(r.timestamp).toLocaleString()}] <@${r.userId}> — ${r.reason} (by <@${r.moderatorId}>)`).join("\n");
      const em = new EmbedBuilder().setTitle("Recent warnings").setDescription(desc).setColor(MAIN_COLOR);
      return interaction.reply({ embeds: [em] });
    }

    // HELP (detailed)
    module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("📚 Hiển thị danh sách các lệnh và công dụng chi tiết")
    .addStringOption(option =>
      option
        .setName("category")
        .setDescription("Chọn nhóm lệnh để xem chi tiết")
        .addChoices(
          { name: "🎛️ Moderation", value: "moderation" },
          { name: "🔧 Utility", value: "utility" },
          { name: "🎁 Giveaway", value: "giveaway" },
          { name: "💰 Economy", value: "economy" },
          { name: "🎶 Music", value: "music" },
          { name: "😄 Fun", value: "fun" },
          { name: "⚙️ System", value: "system" },
          { name: "👑 Owner", value: "owner" },
          { name: "Tất cả", value: "all" }
        )
    ),

  async execute(interaction) {
    const cat = interaction.options.getString("category") || "all";

    const commands = {
      moderation: [
        "`/ban` – Cấm người dùng khỏi server.",
        "`/kick` – Đuổi người dùng khỏi server.",
        "`/mute` – Cấm nói tạm thời.",
        "`/unmute` – Gỡ mute người dùng.",
        "`/clear` – Xóa tin nhắn hàng loạt.",
      ],
      utility: [
        "`/userinfo` – Xem thông tin người dùng.",
        "`/serverinfo` – Xem thông tin server.",
        "`/ping` – Kiểm tra độ trễ của bot.",
        "`/avatar` – Lấy ảnh đại diện người dùng.",
        "`/roleinfo` – Xem thông tin role.",
      ],
      giveaway: [
        "`/giveaway` – Tạo event giveaway phần thưởng.",
        "`/reroll` – Chọn lại người thắng.",
        "`/endgiveaway` – Kết thúc giveaway thủ công.",
      ],
      economy: [
        "`/balance` – Kiểm tra số dư.",
        "`/give` – Chuyển tiền cho người khác.",
        "`/daily` – Nhận phần thưởng hằng ngày.",
        "`/shop` – Mở cửa hàng vật phẩm.",
        "`/buy` – Mua vật phẩm.",
      ],
      music: [
        "`/play` – Phát nhạc từ YouTube/Spotify.",
        "`/pause` – Tạm dừng nhạc.",
        "`/resume` – Tiếp tục phát.",
        "`/skip` – Bỏ qua bài hát.",
        "`/queue` – Xem danh sách phát.",
        "`/stop` – Dừng nhạc và rời kênh.",
      ],
      fun: [
        "`/meme` – Gửi meme ngẫu nhiên.",
        "`/8ball` – Trả lời câu hỏi có/không vui nhộn.",
        "`/say` – Bot nói lại nội dung bạn nhập.",
        "`/love` – Tính % tình yêu giữa 2 người.",
      ],
      system: [
        "`/botinfo` – Thông tin về bot.",
        "`/uptime` – Thời gian hoạt động bot.",
        "`/stats` – Thống kê server.",
      ],
      owner: [
        "`/eval` – Thực thi code (chủ bot).",
        "`/reload` – Tải lại lệnh mà không restart.",
        "`/shutdown` – Tắt bot.",
      ]
    };

    const embed = new EmbedBuilder()
      .setColor("#ff9fd9")
      .setTitle("🌸 Danh Sách Lệnh Meiya")
      .setThumbnail(interaction.client.user.displayAvatarURL())
      .setDescription("Sử dụng `/help [category]` để xem theo nhóm hoặc `/help` để xem tất cả.")
      .setFooter({ text: "Meiya • Hệ thống trợ lý Discord thông minh 💖" });

    if (cat === "all") {
      for (const [category, list] of Object.entries(commands)) {
        embed.addFields({ name: `💫 ${category.toUpperCase()}`, value: list.join("\n"), inline: false });
      }
    } else {
      embed.addFields({ name: `💫 ${cat.toUpperCase()}`, value: commands[cat].join("\n") });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

    // fallback for any unhandled but registered commands
    const registeredNames = commands.map(c => c.name);
    if (registeredNames.includes(cmd)) {
      return interaction.reply({ content: "❓ Lệnh đã đăng ký nhưng chưa triển khai logic chi tiết. Mình sẽ thêm nếu bạn muốn.", ephemeral: true });
    }

    // default fallback
    return interaction.reply({ content: "❓ Lệnh chưa được triển khai.", ephemeral: true });

  } catch (err) {
    console.error("interaction error:", err);
    try {
      if (interaction.replied || interaction.deferred) interaction.followUp({ content: "❌ Lỗi khi chạy lệnh.", ephemeral: true });
      else interaction.reply({ content: "❌ Lỗi khi chạy lệnh.", ephemeral: true });
    } catch {}
  }
});

// logging helper
function logToChannel(guildId, text) {
  try {
    const cfg = getGuildConfig.get(guildId);
    if (!cfg || !cfg.logChannelId) return;
    const g = client.guilds.cache.get(guildId);
    if (!g) return;
    const ch = g.channels.cache.get(cfg.logChannelId);
    if (!ch) return;
    ch.send({ content: text }).catch(()=>{});
  } catch (e) { console.warn("logToChannel error:", e); }
}
client.once("ready", async () => {
  console.log(`✅ Bot ${client.user.username} đã hoạt động!`);
  const data = db.prepare("SELECT * FROM giveaways WHERE ended=0").all();
  for (const g of data) {
    try {
      const channel = await client.channels.fetch(g.channel_id);
      const msg = await channel.messages.fetch(g.message_id);
      scheduleGiveaway(client, msg, g.end_time, g.winners, g.prize, { user: { id: g.host_id } });
    } catch (e) {
      console.warn("Không thể khôi phục giveaway:", g.id);
    }
  }
});
client.once("ready", () => {
  console.log(`✅ ${client.user.tag} đã online!`);
  giveaway.restoreGiveaways(client);
});
// login
const token = process.env.TOKEN;
if (!token) {
  console.error("❌ Missing TOKEN in .env");
  process.exit(1);
}
client.login(token).catch(err => {
  console.error("Login error:", err);
  process.exit(1);
});
