const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
module.exports = {
  data: new SlashCommandBuilder()
    .setName("clear")
    .setDescription("🧹 Xóa hàng loạt tin nhắn trong kênh")
    .addIntegerOption(o => o.setName("số_lượng").setDescription("Số tin cần xóa (1–100)").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  async execute(interaction) {
    const count = interaction.options.getInteger("số_lượng");
    if (count < 1 || count > 100) return interaction.reply({ content: "❌ Số lượng phải trong khoảng 1–100", ephemeral: true });
    try {
      await interaction.channel.bulkDelete(count, true);
      interaction.reply({ content: `🧹 Đã xóa ${count} tin nhắn.`, ephemeral: false });
    } catch (err) {
      console.error(err);
      interaction.reply({ content: "❌ Lỗi khi xóa tin nhắn (có thể do tin nhắn quá cũ).", ephemeral: true });
    }
  }
};
