const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
// This command stores warns in a simple table: warns(guild_id, user_id, moderator_id, reason, timestamp)
module.exports = {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("⚠️ Cảnh cáo một thành viên (lưu vào history)")
    .addUserOption(o => o.setName("thành_viên").setDescription("Ai bị warn").setRequired(true))
    .addStringOption(o => o.setName("lý_do").setDescription("Lý do").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  async execute(interaction, client) {
    const user = interaction.options.getUser("thành_viên");
    const reason = interaction.options.getString("lý_do") || "Không có lý do";
    const guildId = interaction.guild.id;
    // ensure table
    client.db.prepare(`CREATE TABLE IF NOT EXISTS warns (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, user_id TEXT, moderator_id TEXT, reason TEXT, time INTEGER)`).run();
    client.db.prepare("INSERT INTO warns (guild_id, user_id, moderator_id, reason, time) VALUES (?, ?, ?, ?, ?)").run(guildId, user.id, interaction.user.id, reason, Date.now());
    await interaction.reply({ content: `⚠️ Đã cảnh cáo ${user.tag} — ${reason}` });
  }
};
