const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("invite")
    .setDescription("🔗 Lấy link mời bot vào server của bạn."),

  async execute(interaction) {
    const clientId = interaction.client.user.id;
    const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=8&scope=bot%20applications.commands`;

    const embed = new EmbedBuilder()
      .setColor("#ff70d3")
      .setTitle("🤖 Mời bot vào server của bạn!")
      .setDescription(`[Bấm vào đây để mời bot](${inviteUrl})`)
      .setFooter({ text: "Cảm ơn vì đã ủng hộ Meyia 💖" });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
