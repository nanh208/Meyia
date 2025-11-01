const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("suggest")
    .setDescription("💡 Gửi đề xuất / ý tưởng mới cho server.")
    .addStringOption(o => o.setName("suggestion").setDescription("Nội dung đề xuất").setRequired(true)),

  async execute(interaction) {
    const suggestion = interaction.options.getString("suggestion");
    const embed = new EmbedBuilder()
      .setColor("#ff70d3")
      .setTitle("💡 Đề xuất mới")
      .setDescription(suggestion)
      .setFooter({ text: `Gửi bởi ${interaction.user.tag}` })
      .setTimestamp();

    const channel = interaction.guild.channels.cache.find(c => c.name.includes("suggest"));
    if (channel) await channel.send({ embeds: [embed] });
    await interaction.reply({ content: "✅ Đề xuất của bạn đã được gửi!", ephemeral: true });
  }
};
