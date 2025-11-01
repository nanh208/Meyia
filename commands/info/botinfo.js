const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
module.exports = {
  data: new SlashCommandBuilder().setName("botinfo").setDescription("🤖 Thông tin bot"),
  async execute(interaction, client) {
    const e = new EmbedBuilder()
      .setTitle(`${client.user.tag}`)
      .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
      .setColor("#ffd6e0")
      .addFields(
        { name: "ID", value: client.user.id, inline: true },
        { name: "Servers", value: `${client.guilds.cache.size}`, inline: true },
        { name: "Users cached", value: `${client.users.cache.size}`, inline: true }
      );
    await interaction.reply({ embeds: [e] });
  }
};
