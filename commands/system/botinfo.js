const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const os = require("os");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("botinfo")
    .setDescription("🤖 Xem thông tin chi tiết về bot."),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor("#ff70d3")
      .setTitle("🤖 Thông tin về Meyia")
      .addFields(
        { name: "👩‍💻 Tác giả", value: "Star Ngọc", inline: true },
        { name: "⚙️ Framework", value: "discord.js v14", inline: true },
        { name: "📅 Tạo lúc", value: `<t:${Math.floor(interaction.client.user.createdTimestamp / 1000)}:F>`, inline: false },
        { name: "🌐 Server đang tham gia", value: `${interaction.client.guilds.cache.size}`, inline: true },
        { name: "📊 Tổng người dùng", value: `${interaction.client.users.cache.size}`, inline: true }
      )
      .setThumbnail(interaction.client.user.displayAvatarURL());

    await interaction.reply({ embeds: [embed] });
  }
};
