const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");

module.exports = {
  name: "help",
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Xem danh sách các lệnh có sẵn."),
  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0x70a1ff)
      .setTitle("💖 Danh sách lệnh của Meyia")
      .setDescription("✨ Một cô bot dễ thương giúp bạn giải trí và quản lý server!")
      .addFields(
        { name: "🎵 Nhạc", value: "/play, /skip, /stop" },
        { name: "⚙️ Quản trị", value: "/warn, /ban, /kick" },
        { name: "💬 Giao tiếp", value: "/saycute, /ai" },
      )
      .setFooter({ text: "Meyia Bot | Made with 💞 by Star Ngọc" });

    await interaction.reply({ embeds: [embed] });
  },
};
