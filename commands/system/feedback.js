const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("feedback")
    .setDescription("💌 Gửi phản hồi riêng cho chủ bot.")
    .addStringOption(o => o.setName("message").setDescription("Nội dung phản hồi").setRequired(true)),

  async execute(interaction) {
    const owner = await interaction.client.users.fetch(process.env.OWNER_ID);
    const msg = interaction.options.getString("message");

    const embed = new EmbedBuilder()
      .setColor("#ff70d3")
      .setTitle("💌 Phản hồi mới")
      .setDescription(msg)
      .setFooter({ text: `Từ: ${interaction.user.tag}` });

    await owner.send({ embeds: [embed] });
    await interaction.reply({ content: "✅ Phản hồi của bạn đã được gửi đến chủ bot.", ephemeral: true });
  }
};
