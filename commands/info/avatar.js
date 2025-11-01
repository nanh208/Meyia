const { SlashCommandBuilder } = require("discord.js");
module.exports = {
  data: new SlashCommandBuilder().setName("avatar").setDescription("🖼️ Lấy avatar của một người")
    .addUserOption(o => o.setName("thành_viên").setDescription("Chọn người").setRequired(false)),
  async execute(interaction) {
    const user = interaction.options.getUser("thành_viên") || interaction.user;
    await interaction.reply({ content: user.displayAvatarURL({ dynamic: true, size: 1024 }) });
  }
};
