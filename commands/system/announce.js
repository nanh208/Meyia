const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
module.exports = {
  data: new SlashCommandBuilder()
    .setName("announce")
    .setDescription("📣 Gửi thông báo dạng embed vào kênh hiện tại")
    .addStringOption(o => o.setName("tiêu_đề").setDescription("Tiêu đề").setRequired(true))
    .addStringOption(o => o.setName("nội_dung").setDescription("Nội dung").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    const title = interaction.options.getString("tiêu_đề");
    const content = interaction.options.getString("nội_dung");
    const { EmbedBuilder } = require("discord.js");
    const embed = new EmbedBuilder().setTitle(title).setDescription(content).setColor("#ffd6e0").setTimestamp();
    await interaction.reply({ content: "✅ Đã gửi thông báo!", ephemeral: true });
    await interaction.channel.send({ embeds: [embed] });
  }
};
