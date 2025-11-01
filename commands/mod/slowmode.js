const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const ms = require("ms");
module.exports = {
  data: new SlashCommandBuilder()
    .setName("slowmode")
    .setDescription("🐢 Đặt slowmode cho kênh")
    .addStringOption(o => o.setName("thời_gian").setDescription("0 để tắt, hoặc 5s, 1m, 1h...").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async execute(interaction) {
    const t = interaction.options.getString("thời_gian");
    if (t === "0") {
      await interaction.channel.setRateLimitPerUser(0);
      return interaction.reply("♻️ Slowmode đã tắt.");
    }
    const dur = ms(t)/1000;
    if (!dur || dur < 0 || dur > 21600) return interaction.reply({ content: "❌ Thời gian không hợp lệ (0–21600s).", ephemeral: true });
    await interaction.channel.setRateLimitPerUser(Math.floor(dur));
    await interaction.reply(`🐢 Slowmode đã đặt: ${t}`);
  }
};
