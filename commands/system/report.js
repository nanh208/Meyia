const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("report")
    .setDescription("🚨 Báo cáo hành vi vi phạm của người dùng khác.")
    .addUserOption(o => o.setName("target").setDescription("Người bị báo cáo").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Lý do báo cáo").setRequired(true)),

  async execute(interaction) {
    const target = interaction.options.getUser("target");
    const reason = interaction.options.getString("reason");

    const reportEmbed = new EmbedBuilder()
      .setColor("#ff70d3")
      .setTitle("🚨 Báo cáo người dùng")
      .addFields(
        { name: "👤 Người bị báo cáo", value: `${target}`, inline: true },
        { name: "🧾 Lý do", value: reason, inline: false },
        { name: "📨 Người gửi", value: interaction.user.tag, inline: true }
      )
      .setTimestamp();

    const logChannel = interaction.guild.channels.cache.find(c => c.name.includes("report") || c.name.includes("log"));
    if (logChannel) await logChannel.send({ embeds: [reportEmbed] });

    await interaction.reply({ content: "✅ Báo cáo của bạn đã được gửi.", ephemeral: true });
  }
};
