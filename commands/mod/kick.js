const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
module.exports = {
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("👢 Kick một thành viên khỏi server")
    .addUserOption(o => o.setName("thành_viên").setDescription("Ai cần kick").setRequired(true))
    .addStringOption(o => o.setName("lý_do").setDescription("Lý do").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  async execute(interaction) {
    const user = interaction.options.getUser("thành_viên");
    const reason = interaction.options.getString("lý_do") || "Không có lý do";
    const member = await interaction.guild.members.fetch(user.id).catch(()=>null);
    if (!member) return interaction.reply({ content: "❌ Không tìm thấy thành viên.", ephemeral: true });
    if (!member.kickable) return interaction.reply({ content: "🚫 Không thể kick người này.", ephemeral: true });
    try {
      await member.kick(reason);
      await interaction.reply({ content: `👢 Đã kick **${user.tag}** — ${reason}` });
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: "❌ Lỗi khi kick.", ephemeral: true });
    }
  }
};
