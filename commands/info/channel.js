const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
module.exports = {
  data: new SlashCommandBuilder().setName("channelinfo").setDescription("ℹ️ Thông tin kênh")
    .addChannelOption(o => o.setName("channel").setDescription("Chọn kênh").setRequired(false)),
  async execute(interaction) {
    const channel = interaction.options.getChannel("channel") || interaction.channel;
    const e = new EmbedBuilder()
      .setTitle(`# ${channel.name}`)
      .setColor("#9be7ff")
      .addFields(
        { name: "ID", value: channel.id, inline: true },
        { name: "Loại", value: channel.type.toString(), inline: true },
        { name: "NSP", value: `${channel.topic || "—"}`, inline: false }
      );
    await interaction.reply({ embeds: [e] });
  }
};
