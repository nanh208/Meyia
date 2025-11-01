const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
module.exports = {
  data: new SlashCommandBuilder()
    .setName("warns")
    .setDescription("📜 Xem lịch sử cảnh cáo của 1 người")
    .addUserOption(o => o.setName("thành_viên").setDescription("Người cần xem").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  async execute(interaction, client) {
    const user = interaction.options.getUser("thành_viên");
    client.db.prepare(`CREATE TABLE IF NOT EXISTS warns (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, user_id TEXT, moderator_id TEXT, reason TEXT, time INTEGER)`).run();
    const rows = client.db.prepare("SELECT * FROM warns WHERE guild_id = ? AND user_id = ? ORDER BY time DESC").all(interaction.guild.id, user.id);
    if (!rows.length) return interaction.reply({ content: "ℹ️ Không có cảnh cáo nào.", ephemeral: true });
    const embed = new EmbedBuilder()
      .setTitle(`📜 Warns của ${user.tag}`)
      .setColor("#ffb86b")
      .setDescription(rows.slice(0, 10).map(r => `• <@${r.moderator_id}> — ${r.reason} — <t:${Math.floor(r.time/1000)}:R>`).join("\n"));
    await interaction.reply({ embeds: [embed] });
  }
};
