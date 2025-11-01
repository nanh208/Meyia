const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
module.exports = {
  data: new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("🔓 Mở khóa kênh hiện tại")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async execute(interaction) {
    try {
      await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: true });
      await interaction.reply("🔓 Kênh này đã được **mở khóa**.");
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: "❌ Lỗi khi mở khóa kênh.", ephemeral: true });
    }
  }
};
    