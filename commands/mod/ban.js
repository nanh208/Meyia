const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
module.exports = {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("🔨 Cấm vĩnh viễn một thành viên")
    .addUserOption(o => o.setName("thành_viên").setDescription("Ai cần ban").setRequired(true))
    .addStringOption(o => o.setName("lý_do").setDescription("Lý do cấm").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  async execute(interaction) {
    const user = interaction.options.getUser("thành_viên");
    const reason = interaction.options.getString("lý_do") || "Không có lý do";
    try {
      await interaction.guild.members.ban(user.id, { reason });
      await interaction.reply({ content: `✅ Đã **ban** ${user.tag} — ${reason}`, ephemeral: false });
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: "❌ Không thể ban thành viên (quyền/role?).", ephemeral: true });
    }
  }
};
