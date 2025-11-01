const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const fs = require("fs");
module.exports = {
  data: new SlashCommandBuilder().setName("reload").setDescription("🔁 Reload một command (dev only)").addStringOption(o=>o.setName("tên_lệnh").setDescription("Tên file command").setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction, client) {
    const name = interaction.options.getString("tên_lệnh");
    // find command file among commands folders
    const path = require("path");
    let found = null;
    const commandsPath = path.join(process.cwd(), "commands");
    for (const folder of fs.readdirSync(commandsPath)) {
      const fp = path.join(commandsPath, folder, `${name}.js`);
      if (fs.existsSync(fp)) { found = fp; break; }
    }
    if (!found) return interaction.reply({ content: "❌ Không tìm thấy file command.", ephemeral: true });
    try {
      delete require.cache[require.resolve(found)];
      const command = require(found);
      client.commands.set(command.data.name, command);
      await interaction.reply({ content: `🔁 Reloaded ${name}`, ephemeral: true });
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: "❌ Lỗi khi reload.", ephemeral: true });
    }
  }
};
