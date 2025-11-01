const { SlashCommandBuilder } = require("discord.js");
module.exports = {
  data: new SlashCommandBuilder().setName("uptime").setDescription("⏱️ Thời gian bot đã hoạt động"),
  async execute(interaction, client) {
    const ms = require("ms");
    await interaction.reply(`⏱️ Uptime: **${ms(client.uptime)}**`);
  }
};
