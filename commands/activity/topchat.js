const { SlashCommandBuilder } = require("discord.js");
module.exports = {
  data: new SlashCommandBuilder().setName("level").setDescription("⭐ Xem level (demo) — dựa trên messages count"),
  async execute(interaction, client) {
    client.db.prepare(`CREATE TABLE IF NOT EXISTS messages (guild_id TEXT, user_id TEXT, count INTEGER, PRIMARY KEY (guild_id, user_id))`).run();
    const row = client.db.prepare("SELECT count FROM messages WHERE guild_id = ? AND user_id = ?").get(interaction.guild.id, interaction.user.id) || { count: 0 };
    const count = row.count || 0;
    // simple level formula: floor(sqrt(count))
    const lvl = Math.floor(Math.sqrt(count));
    await interaction.reply(`⭐ ${interaction.user.tag}, bạn có **${count}** tin — Level: **${lvl}**`);
  }
};
