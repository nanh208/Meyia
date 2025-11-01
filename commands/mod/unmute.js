const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
module.exports = {
  data: new SlashCommandBuilder()
    .setName("unmute")
    .setDescription("🔊 Bỏ mute thành viên")
    .addUserOption(o => o.setName("thành_viên").setDescription("Chọn ai để unmute").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  async execute(interaction) {
    const member = interaction.options.getMember("thành_viên");
    try {
      await member.timeout(null, "Unmuted by command");
      await interaction.reply({ content: `🔊 Đã bỏ mute ${member.user.tag}` });
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: "❌ Không thể unmute.", ephemeral: true });
    }
  }
};
