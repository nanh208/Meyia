const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
module.exports = {
  data: new SlashCommandBuilder()
    .setName("clearwarns")
    .setDescription("🧾 Xóa lịch sử cảnh cáo một người (toàn bộ)")
    .addUserOption(o => o.setName("thành_viên").setDescription("Ai cần xóa warns").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction, client) {
    const user = interaction.options.getUser("thành_viên");
    client.db.prepare(`CREATE TABLE IF NOT EXISTS warns (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, user_id TEXT, moderator_id TEXT, reason TEXT, time INTEGER)`).run();
    client.db.prepare("DELETE FROM warns WHERE guild_id = ? AND user_id = ?").run(interaction.guild.id, user.id);
    await interaction.reply({ content: `✅ Đã xóa toàn bộ warns của ${user.tag}` });
  }
};
