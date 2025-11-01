const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const os = require("os");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("stats")
    .setDescription("📊 Xem thông tin thống kê hệ thống bot."),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor("#ff70d3")
      .setTitle("📊 Thống kê hệ thống")
      .addFields(
        { name: "📡 Servers", value: `${interaction.client.guilds.cache.size}`, inline: true },
        { name: "👥 Users", value: `${interaction.client.users.cache.size}`, inline: true },
        { name: "💾 RAM", value: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`, inline: true },
        { name: "⚙️ CPU", value: `${os.cpus()[0].model}`, inline: false }
      )
      .setFooter({ text: `Ping: ${interaction.client.ws.ping}ms` });

    await interaction.reply({ embeds: [embed] });
  }
};
