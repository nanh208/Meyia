// deploy-commands.js
require("dotenv").config();
const { REST, Routes } = require("discord.js");
const fs = require("fs");

const commands = [];
const foldersPath = "./commands";
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
  const commandsPath = `${foldersPath}/${folder}`;
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));
  for (const file of commandFiles) {
    const command = require(`${commandsPath}/${file}`);
    if ("data" in command && "execute" in command) {
      commands.push(command.data.toJSON());
    } else {
      console.log(`[⚠️] Lệnh tại ${file} bị thiếu thuộc tính "data" hoặc "execute".`);
    }
  }
}

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log("🔄 Đang cập nhật slash commands...");

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );

    console.log("✅ Hoàn tất! Slash commands đã được cập nhật lên Discord.");
  } catch (error) {
    console.error(error);
  }
})();
