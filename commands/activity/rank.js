const { SlashCommandBuilder } = require("discord.js");
module.exports = {
  data: new SlashCommandBuilder().setName("rank").setDescription("📈 Xem rank của bạn trong server"),
  async execute(interaction, client) {
    client.db.prepare(`CREATE TABLE IF NOT EXISTS messages (guild_id TEXT, user_id TEXT, count INTEGER, PRIMARY KEY (guild_id, user_id))`).run();
    const rows = client.db.prepare("SELECT user_id, count FROM messages WHERE guild_id = ? ORDER BY count DESC").all(interaction.guild.id);
    if (!rows.length) return interaction.reply({ content: "ℹ️ Không có dữ liệu.", ephemeral: true });
    const idx = rows.findIndex(r => r.user_id === interaction.user.id);
    if (idx === -1) return interaction.reply({ content: "ℹ️ Bạn chưa có dữ liệu chat.", ephemeral: true });
    await interaction.reply(`📈 Bạn đang đứng **#${idx+1}** với **${rows[idx].count}** tin.`);
  }
};
