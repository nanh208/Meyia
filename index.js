// index.js — Meiya All-in-One (Giveaway + Music + Cute Presence)
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Client, GatewayIntentBits, Collection } = require("discord.js");
const Database = require("better-sqlite3").default || require("better-sqlite3");
const { setupPlayer } = require("./utils/playerSetup");

// ====== CONFIG ======
const MAIN_COLOR = "#ff70d3";

// ====== DATABASE (Giveaway) ======
const db = new Database("giveaways.db");
db.prepare(`CREATE TABLE IF NOT EXISTS giveaways (
  id TEXT PRIMARY KEY,
  channel_id TEXT,
  message_id TEXT,
  prize TEXT,
  winners INTEGER,
  end_time INTEGER,
  host_id TEXT
)`).run();

// ====== CLIENT SETUP ======
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions
  ]
});

client.commands = new Collection();
client.db = db;
client.MAIN_COLOR = MAIN_COLOR;

// ====== UTILS ======
const { scheduleGiveaway } = require("./utils/giveawayScheduler");
client.scheduleGiveaway = scheduleGiveaway;

// ====== MUSIC PLAYER ======
setupPlayer(client); // Gọi setupPlayer (discord-player)

// ====== LOAD SLASH COMMANDS ======
const foldersPath = path.join(__dirname, "commands");
for (const folder of fs.readdirSync(foldersPath)) {
  const commandsPath = path.join(foldersPath, folder);
  for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith(".js"))) {
    const command = require(path.join(commandsPath, file));
    client.commands.set(command.data.name, command);
  }
}

// ====== EVENT: READY ======
client.once("clientReady", () => {
  console.log(`✅ Đăng nhập thành công: ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: "🌸 | /play và /help để xem lệnh", type: 0 }],
    status: "online"
  });

  // 🔁 Khởi động lại các giveaway đang chạy
  const giveaways = db.prepare("SELECT * FROM giveaways").all();
  for (const g of giveaways) {
    if (Date.now() < g.end_time) {
      const channel = client.channels.cache.get(g.channel_id);
      if (channel) {
        channel.messages.fetch(g.message_id)
          .then(msg => scheduleGiveaway(client, msg, g.end_time, g.winners, g.prize))
          .catch(() => {});
      }
    }
  }
});

// ====== EVENT: SLASH COMMAND ======
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, client);
  } catch (err) {
    console.error("❌ Command error:", err);
    const errorMsg = "⚠️ Có lỗi xảy ra khi chạy lệnh này.";
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errorMsg, ephemeral: true });
    } else {
      await interaction.reply({ content: errorMsg, ephemeral: true });
    }
  }
});

// ====== LOGIN ======
client.login(process.env.TOKEN);
