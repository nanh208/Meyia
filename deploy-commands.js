require("dotenv").config();
const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");

// Lấy biến môi trường
const CLIENT_ID = process.env.CLIENT_ID;
const TOKEN = process.env.TOKEN;

if (!CLIENT_ID || !TOKEN) {
  console.error("❌ Lỗi: Thiếu CLIENT_ID hoặc TOKEN trong file .env");
  process.exit(1);
}

// Hàm đọc đệ quy tất cả file lệnh trong thư mục commands
function getAllCommandFiles(dir) {
  const commandFiles = [];
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      commandFiles.push(...getAllCommandFiles(filePath));
    } else if (file.endsWith(".js")) {
      commandFiles.push(filePath);
    }
  }

  return commandFiles;
}

// Đọc tất cả file lệnh
const commandFiles = getAllCommandFiles(path.join(__dirname, "commands"));
const commands = [];

for (const file of commandFiles) {
  try {
    const command = require(file);
    if (command.data && command.data.name) {
      commands.push(command.data.toJSON());
      console.log(`✅ Đã tải lệnh: ${command.data.name}`);
    } else {
      console.warn(`⚠️ Bỏ qua file không hợp lệ: ${file}`);
    }
  } catch (err) {
    console.error(`❌ Lỗi khi đọc file ${file}:`, err);
  }
}

// Triển khai lệnh
const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    console.log("🔄 Đang cập nhật slash commands lên Discord...");
const GUILD_ID = process.env.GUILD_ID;

if (!GUILD_ID) {
  console.warn("⚠️ Thiếu GUILD_ID, deploy toàn cầu (mất vài phút để hiển thị).");
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
} else {
  console.log(`🔧 Deploy trong server ID: ${GUILD_ID}`);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
}


    console.log(`🎉 Hoàn tất! Đã cập nhật ${commands.length} lệnh lên Discord.`);
  } catch (error) {
    console.error("❌ Lỗi khi deploy lệnh:", error);
  }
})();
