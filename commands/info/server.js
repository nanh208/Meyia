const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
module.exports = {
  data: new SlashCommandBuilder().setName("serverinfo").setDescription("📊 Thông tin server hiện tại"),
  async execute(interaction) {
    const g = interaction.guild;
    const e = new EmbedBuilder()
      .setColor("#ff70d3")
      .setTitle(`🏰 ${g.name}`)
      .setThumbnail(g.iconURL({ dynamic: true }))
      .addFields(
        { name: "👑 Chủ server", value: `<@${g.ownerId}>`, inline: true },
        { name: "🧍 Thành viên", value: `${g.memberCount}`, inline: true },
        { name: "📅 Tạo lúc", value: `<t:${Math.floor(g.createdTimestamp / 1000)}:R>`, inline: true }
      );
    await interaction.reply({ embeds: [e] });
  }
};
