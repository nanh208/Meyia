const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const ms = require("ms");
module.exports = {
  data: new SlashCommandBuilder()
    .setName("mute")
    .setDescription("🔇 Mute một thành viên tạm thời")
    .addUserOption(o => o.setName("thành_viên").setDescription("Chọn ai để mute").setRequired(true))
    .addStringOption(o => o.setName("thời_gian").setDescription("Thời gian (vd: 10m, 1h)").setRequired(true))
    .addStringOption(o => o.setName("lý_do").setDescription("Lý do").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  async execute(interaction) {
    const member = interaction.options.getMember("thành_viên");
    const durationStr = interaction.options.getString("thời_gian");
    const reason = interaction.options.getString("lý_do") || "Không có lý do";
    const duration = ms(durationStr);
    if (!duration) return interaction.reply({ content: "❌ Thời gian không hợp lệ.", ephemeral: true });
    try {
      await member.timeout(duration, reason);
      interaction.reply({ content: `🔇 Đã mute ${member.user.tag} trong ${durationStr} — ${reason}` });
    } catch (err) {
      console.error(err);
      interaction.reply({ content: "❌ Không thể mute (quyền/role?).", ephemeral: true });
    }
  }
};
