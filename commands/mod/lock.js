const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
module.exports = {
  data: new SlashCommandBuilder()
    .setName("lock")
    .setDescription("🔒 Khóa kênh hiện tại")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async execute(interaction) {
    try {
      await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });
      await interaction.reply("🔒 Kênh này đã bị **khóa**.");
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: "❌ Lỗi khi khóa kênh.", ephemeral: true });
    }
  }
};
