const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const os = require("os");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("botinfo")
    .setDescription("🤖 Xem thông tin chi tiết về bot."),

  async execute(interaction) {
    const botUser = interaction.client.user;

    const embed = new EmbedBuilder()
      .setColor("#ff70d3")
      .setTitle("🤖 Thông tin về Meyia")
      .setThumbnail(botUser.displayAvatarURL())
      .addFields(
        { name: "👩‍💻 Người tạo", value: `<@1409222785154416651> ( Ngọc)`, inline: true },
        { name: "⚙️ Framework", value: "discord.js v14", inline: true },
        { name: "🆔 ID Bot", value: `${botUser.id}`, inline: true },
        { name: "🏷️ Tag", value: `${botUser.tag}`, inline: true },
        { name: "📅 Ngày tạo bot", value: `<t:${Math.floor(botUser.createdTimestamp / 1000)}:F>`, inline: false },
        { name: "🌐 Server đang tham gia", value: `${interaction.client.guilds.cache.size}`, inline: true },
        { name: "📊 Tổng người dùng", value: `${interaction.client.users.cache.size}`, inline: true },
        { name: "💻 Hệ thống", value: `${os.type()} ${os.release()}`, inline: true },
        { name: "🕐 Thời gian hoạt động", value: `<t:${Math.floor((Date.now() - interaction.client.uptime) / 1000)}:R>`, inline: true }
      )
      .setFooter({ text: "Meyia Bot • Developed by Ngọc", iconURL: botUser.displayAvatarURL() });

    await interaction.reply({ embeds: [embed] });
  }
};
