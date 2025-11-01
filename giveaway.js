// index.js — Meyia v2.1 — All-In-One Discord Bot 💖
// --------------------------------------------------
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const {
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  Events
} = require("discord.js");
const { GiveawaysManager } = require("discord-giveaways");
const Database = require("better-sqlite3");
const ms = require("ms");

// ======================
// 🔧 CẤU HÌNH CLIENT
// ======================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

client.commands = new Collection();

// ======================
// 📂 TẢI LỆNH TỰ ĐỘNG
// ======================
const foldersPath = path.join(__dirname, "commands");
if (!fs.existsSync(foldersPath)) fs.mkdirSync(foldersPath);

const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
  const commandsPath = path.join(foldersPath, folder);
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js"));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ("data" in command && "execute" in command) {
      client.commands.set(command.data.name, command);
      console.log(`✅ Đã tải lệnh: ${folder}/${command.data.name}`);
    } else {
      console.warn(`⚠️ Bỏ qua ${filePath} (thiếu data/execute)`);
    }
  }
}

// ======================
// 🎁 GIVEAWAY MANAGER
// ======================
const dbPath = path.join(__dirname, "giveaways.db");
if (!fs.existsSync(path.join(__dirname, "database"))) fs.mkdirSync(path.join(__dirname, "database"));

const giveawayDB = new Database(dbPath);
client.giveawaysManager = new GiveawaysManager(client, {
  storage: dbPath,
  default: {
    botsCanWin: false,
    embedColor: "#FF66CC",
    reaction: "🎉"
  }
});

// ======================
// 🤖 SỰ KIỆN: BOT SẴN SÀNG
// ======================
client.once(Events.ClientReady, (c) => {
  console.log(`✨ Đăng nhập thành công với tên: ${c.user.tag}`);
  c.user.setPresence({
    activities: [{ name: `/help • by Meyia 💖`, type: 0 }],
    status: "online"
  });
});

// ======================
// ⚙️ XỬ LÝ LỆNH / INTERACTION
// ======================
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) {
    console.log(`⚠️ Không tìm thấy lệnh: ${interaction.commandName}`);
    return;
  }

  try {
    await command.execute(interaction, client);
    console.log(`📘 ${interaction.user.tag} đã dùng /${interaction.commandName}`);
  } catch (error) {
    console.error(`❌ Lỗi khi thực thi /${interaction.commandName}:`, error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: "❌ Đã xảy ra lỗi khi chạy lệnh này!",
        ephemeral: true
      });
    } else {
      await interaction.reply({
        content: "❌ Đã xảy ra lỗi khi chạy lệnh này!",
        ephemeral: true
      });
    }
  }
});

// ======================
// 📜 GHI LOG LỖI TOÀN CỤC
// ======================
process.on("unhandledRejection", (error) => {
  console.error("🚨 Lỗi không bắt được:", error);
});
process.on("uncaughtException", (error) => {
  console.error("🔥 Lỗi không xử lý:", error);
});

// ======================
// 🚀 ĐĂNG NHẬP BOT
// ======================
client.login(process.env.TOKEN);
