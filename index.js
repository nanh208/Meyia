// index.js — Meyia All-in-One Bot (Full Stable Modular Version)
// =============================================================
// ⚙️ Vai trò: Khởi tạo bot, load lệnh, sự kiện, DB, AI, và logging.
// -------------------------------------------------------------

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { 
  Client, 
  GatewayIntentBits, 
  Partials, 
  Collection, 
  Events 
} = require("discord.js");

const { loadCommands } = require("./src/commands");
const { loadEvents } = require("./src/utils/loader");
const { connectDB, loadReminders } = require("./src/utils/db");
const { logToChannel } = require("./src/utils/logger");

// =============== ⚙️ 1. Tạo Client Discord ===============
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.commands = new Collection();

// =============== ⚙️ 2. Khi bot sẵn sàng ===============
client.once(Events.ClientReady, async () => {
  console.log(`✅ Đã đăng nhập: ${client.user.tag}`);

  try {
    // Kết nối DB (SQLite)
    await connectDB();

    // Nạp lệnh slash
    await loadCommands(client);

    // Nạp sự kiện (message, voice, join, v.v.)
    await loadEvents(client);

    // Khôi phục reminder
    await loadReminders(client);

    // Set trạng thái bot
    client.user.setPresence({
      activities: [{ name: "💞 cùng bạn chill ở Discord", type: 0 }],
      status: "online",
    });

    // Ghi log khởi động
    logToChannel(client, "✅ Meyia đã khởi động thành công!");
  } catch (err) {
    console.error("❌ Lỗi khi khởi tạo bot:", err);
  }
});

// =============== ⚙️ 3. Xử lý Slash Command ===============
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, client);
  } catch (error) {
    console.error(`❌ Lỗi ở /${interaction.commandName}:`, error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: "😵 Meyia bị lỗi nhẹ... thử lại sau nha~",
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: "😵 Meyia bị lỗi nhẹ... thử lại sau nha~",
        ephemeral: true,
      });
    }
  }
});

// =============== ⚙️ 4. Xử lý lỗi Promise toàn cục ===============
process.on("unhandledRejection", (err) => {
  console.error("⚠️ Lỗi Promise:", err);
});

process.on("uncaughtException", (err) => {
  console.error("💥 Lỗi không bắt được:", err);
});

// =============== ⚙️ 5. Đăng nhập bot ===============
client.login(process.env.TOKEN).catch((err) => {
  console.error("❌ Không thể đăng nhập bot:", err);
});
