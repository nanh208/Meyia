const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
module.exports = {
  data: new SlashCommandBuilder().setName("roleinfo").setDescription("🔖 Thông tin role")
    .addRoleOption(o => o.setName("role").setDescription("Chọn role").setRequired(true)),
  async execute(interaction) {
    const role = interaction.options.getRole("role");
    const e = new EmbedBuilder()
      .setTitle(`${role.name}`)
      .setColor(role.color || "#888888")
      .addFields(
        { name: "ID", value: role.id, inline: true },
        { name: "Số thành viên", value: `${role.members.size}`, inline: true },
        { name: "Vị trí", value: `${role.position}`, inline: true }
      );
    await interaction.reply({ embeds: [e] });
  }
};
