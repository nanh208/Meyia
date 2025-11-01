const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
module.exports = {
  data: new SlashCommandBuilder()
    .setName("say")
    .setDescription("📣 Cho bot nói thay bạn")
    .addStringOption(o => o.setName("nội_dung").setDescription("Tin nhắn muốn gửi").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  async execute(interaction) {
    const msg = interaction.options.getString("nội_dung");
    await interaction.reply({ content: "✅ Đã gửi!", ephemeral: true });
    await interaction.channel.send(msg);
  }
};
