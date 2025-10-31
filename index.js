// index.js — Meiya (Slash + SQLite) — NO MUSIC
require("dotenv").config();
const { Client, GatewayIntentBits, Partials, Events, EmbedBuilder, PermissionsBitField, ApplicationCommandOptionType } = require("discord.js");
const path = require("path");
const fs = require("fs");
const ms = require("ms");
const Database = require("better-sqlite3");
const fetch = require("node-fetch"); // optional for weather/translate if you add API keys

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
  partials: [Partials.Channel]
});

// utility
function isAdmin(member) {
  try {
    return member.permissions.has(PermissionsBitField.Flags.Administrator) || member.id === OWNER_ID;
  } catch { return false; }
}

function ensureMuteRole(guild) {
  // create or return 'Meiya Muted' role
  const roleName = "Meiya Muted";
  let role = guild.roles.cache.find(r => r.name === roleName);
  if (!role) {
    // create role
    role = guild.roles.create({ name: roleName, permissions: [] }).catch(() => null);
  }
  return role;
}

// register commands list
const commands = [
  // Moderation
  { name: "ban", description: "Ban member", options: [{ name: "user", type: ApplicationCommandOptionType.User, required: true }, { name: "reason", type: ApplicationCommandOptionType.String, required: false }] },
  { name: "kick", description: "Kick member", options: [{ name: "user", type: ApplicationCommandOptionType.User, required: true }, { name: "reason", type: ApplicationCommandOptionType.String, required: false }] },
  { name: "unban", description: "Unban by user ID", options: [{ name: "userid", type: ApplicationCommandOptionType.String, required: true }] },
  { name: "timeout", description: "Timeout (in minutes)", options: [{ name: "user", type: ApplicationCommandOptionType.User, required: true }, { name: "minutes", type: ApplicationCommandOptionType.Integer, required: true }, { name: "reason", type: ApplicationCommandOptionType.String, required: false }] },
  { name: "clear", description: "Bulk delete messages", options: [{ name: "amount", type: ApplicationCommandOptionType.Integer, required: true }] },
  { name: "lock", description: "Lock a channel" },
  { name: "unlock", description: "Unlock a channel" },
  { name: "mute", description: "Mute member (adds muted role)", options: [{ name: "user", type: ApplicationCommandOptionType.User, required: true }, { name: "minutes", type: ApplicationCommandOptionType.Integer, required: false }] },
  { name: "unmute", description: "Unmute member", options: [{ name: "user", type: ApplicationCommandOptionType.User, required: true }] },
  // warn
  { name: "warn", description: "Warn a user", options: [{ name: "user", type: ApplicationCommandOptionType.User, required: true }, { name: "reason", type: ApplicationCommandOptionType.String, required: true }] },
  { name: "warnings", description: "List warnings for a user", options: [{ name: "user", type: ApplicationCommandOptionType.User, required: true }] },
  { name: "clearwarn", description: "Clear warnings for a user", options: [{ name: "user", type: ApplicationCommandOptionType.User, required: true }] },
  { name: "setlog", description: "Set mod log channel", options: [{ name: "channel", type: ApplicationCommandOptionType.Channel, required: true }] },

  // Utility/Info
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

  // fun
  { name: "quote", description: "Random quote" }
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
    // due now
    deliverReminder(row).catch(console.error);
    return;
  }
  setTimeout(async () => {
    await deliverReminder(row);
  }, delay);
}

async function deliverReminder(row) {
  try {
    const guild = client.guilds.cache.get(row.guildId);
    const user = await client.users.fetch(row.userId).catch(() => null);
    if (user) {
      user.send(`🔔 Reminder: ${row.message}`).catch(() => {});
    }
    // remove from db
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
      if (!isAdmin(interaction.member)) return interaction.reply({ content: "🚀 Đã mở khóa kênh.", ephemeral: true });
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
      // use timeout if available
      if (minutes > 0) {
        await member.timeout(minutes * 60 * 1000, `Muted by ${interaction.user.tag}`).catch(() => {});
        interaction.reply({ content: `🔇 Đã tạm mute ${user.tag} trong ${minutes} phút (timeout).` });
      } else {
        // fallback: role-based mute
        let role = interaction.guild.roles.cache.find(r => r.name === "Meiya Muted");
        if (!role) {
          role = await interaction.guild.roles.create({ name: "Meiya Muted", permissions: [] });
          // apply overwrites to all channels
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
      // remove role if exists and try to clear timeout
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
      // send to channel
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

    // REMINDERS
    if (cmd === "remind") {
      const timeStr = interaction.options.getString("time");
      const text = interaction.options.getString("text");
      // parse simple format like 10m 2h 1d
      let msTime = 0;
      try {
        msTime = ms(timeStr); // using ms package
      } catch { msTime = 0; }
      if (!msTime) return interaction.reply({ content: "⏳ Không hiểu thời gian (ví dụ: 10m, 2h, 1d).", ephemeral: true });
      const remindAt = Date.now() + msTime;
      const createdAt = Date.now();
      const info = insertReminder.run(interaction.guild.id, interaction.user.id, remindAt, text, createdAt);
      const id = info.lastInsertRowid;
      // schedule
      scheduleReminder({ id, guildId: interaction.guild.id, userId: interaction.user.id, remindAt, message: text, createdAt });
      interaction.reply({ content: `🔔 Reminder đã đặt cho <t:${Math.floor(remindAt/1000)}:F>`, ephemeral: true });
      return;
    }

    // unknown fallback
    return interaction.reply({ content: "❓ Lệnh chưa được triển khai.", ephemeral: true });

  } catch (err) {
    console.error("interaction error:", err);
    try { if (interaction.replied || interaction.deferred) interaction.followUp({ content: "❌ Lỗi khi chạy lệnh.", ephemeral: true }); else interaction.reply({ content: "❌ Lỗi khi chạy lệnh.", ephemeral: true }); } catch {}
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
