const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const os = require("os");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("uptime")
    .setDescription("⏳ Xem bot đã hoạt động bao lâu."),

  async execute(interaction) {
    const uptime = process.uptime();
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor(uptime % 86400 / 3600);
    const minutes = Math.floor(uptime % 3600 / 60);

    const embed = new EmbedBuilder()
      .setColor("#ff70d3")
      .setTitle("⏳ Uptime của bot")
      .setDescription(`Bot đã online được **${days} ngày, ${hours} giờ, ${minutes} phút**.`)
      .setFooter({ text: `Yêu cầu bởi ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

    await interaction.reply({ embeds: [embed] });
  }
};
