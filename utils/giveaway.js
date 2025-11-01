const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const ms = require("ms");

function parseTime(str) {
  try { return ms(str); } catch { return null; }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("🎁 Tạo một sự kiện giveaway mới")
    .addStringOption(o => o.setName("phần_thưởng").setDescription("Phần thưởng là gì?").setRequired(true))
    .addIntegerOption(o => o.setName("số_lượng_giải").setDescription("Số người thắng").setRequired(true))
    .addStringOption(o => o.setName("thời_gian").setDescription("Thời gian (vd: 10m, 1h, 1d)").setRequired(true)),

  async execute(interaction, client) {
    try {
      const prize = interaction.options.getString("phần_thưởng");
      const numWinners = interaction.options.getInteger("số_lượng_giải");
      const time = parseTime(interaction.options.getString("thời_gian"));
      if (!time) return interaction.reply({ content: "❌ Thời gian không hợp lệ!", ephemeral: true });

      const endTime = Date.now() + time;

      const embed = new EmbedBuilder()
        .setColor(client.MAIN_COLOR)
        .setTitle("<a:1255341894687260775:1433317867293642858> **GIVEAWAY** <a:1255340646248616061:1433317989406605383>")
        .setDescription(
          `🎁 **Phần thưởng:** ${prize}\n` +
          `<a:1255340646248616061:1433317989406605383> **Số lượng giải:** ${numWinners}\n` +
          `⌛ **Thời gian:** ${interaction.options.getString("thời_gian")}\n` +
          `👑 **Người tổ chức:** <@${interaction.user.id}>`
        )
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: "Nhấn 🎉 để tham gia!", iconURL: interaction.client.user.displayAvatarURL() });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("join_giveaway")
          .setLabel("🎉 Tham Gia")
          .setStyle(ButtonStyle.Success)
      );

      const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

      client.db.prepare(`INSERT INTO giveaways (id, channel_id, message_id, prize, winners, end_time, host_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(msg.id, interaction.channel.id, msg.id, prize, numWinners, endTime, interaction.user.id);

      client.scheduleGiveaway(client, msg, endTime, numWinners, prize, interaction);
    } catch (err) {
      console.error("Giveaway error:", err);
      return interaction.reply({ content: "❌ Có lỗi xảy ra khi tạo giveaway.", ephemeral: true });
    }
  },
};
