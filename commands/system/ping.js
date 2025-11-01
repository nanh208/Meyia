const { SlashCommandBuilder } = require("discord.js");
module.exports = {
  data: new SlashCommandBuilder().setName("ping").setDescription("🏓 Kiểm tra tốc độ phản hồi bot"),
  async execute(interaction) {
    const sent = await interaction.reply({ content: "🏓...", fetchReply: true });
    await interaction.editReply(`🏓 Pong! Ping: **${sent.createdTimestamp - interaction.createdTimestamp}ms**`);
  }
};
