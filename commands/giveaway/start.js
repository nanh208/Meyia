const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const ms = require("ms");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("🎉 Tạo một giveaway mới")
    .addStringOption(opt => 
      opt.setName("thời_gian")
        .setDescription("Thời gian (ví dụ: 10m, 1h, 2d)")
        .setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName("số_người_thắng")
        .setDescription("Số lượng người chiến thắng")
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName("phần_thưởng")
        .setDescription("Phần thưởng của giveaway")
        .setRequired(true)
    ),

  async execute(interaction, client) {
    try {
      const duration = ms(interaction.options.getString("thời_gian"));
      const winnerCount = interaction.options.getInteger("số_người_thắng");
      const prize = interaction.options.getString("phần_thưởng");

      if (!duration || duration <= 0)
        return interaction.reply({ content: "❌ Thời gian không hợp lệ!", ephemeral: true });

      const endTime = Date.now() + duration;
      const giveawayId = Math.floor(Math.random() * 999999999);

      const embed = new EmbedBuilder()
        .setColor(client.MAIN_COLOR)
        .setTitle(`<a:1255341894687260775:1433317867293642858> G I V E A W A Y <a:1255341894687260775:1433317867293642858>`)
        .setDescription(
          `🎁 **Phần thưởng:** ${prize}\n\n` +
          `<a:1255340646248616061:1433317989406605383> Nhấn emoji bên dưới để tham gia!\n\n` +
          `👑 **Tổ chức bởi:** ${interaction.user}\n` +
          `🏆 **Số lượng giải:** ${winnerCount}\n` +
          `⏰ **Kết thúc:** <t:${Math.floor(endTime / 1000)}:R>`
        )
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: `📛 Mã giveaway: ${giveawayId}` });

      const msg = await interaction.channel.send({ embeds: [embed] });
      await msg.react("<a:1261960933270618192:1433286685189341204>");

      const db = client.db;
      db.prepare(`INSERT OR REPLACE INTO giveaways (id, channel_id, message_id, prize, winners, end_time, host_id)
                  VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(giveawayId, interaction.channel.id, msg.id, prize, winnerCount, endTime, interaction.user.id);

      client.scheduleGiveaway(client, msg, endTime, winnerCount, prize);

      await interaction.reply({ content: "✅ Giveaway đã được tạo thành công!", ephemeral: true });
    } catch (err) {
      console.error("Giveaway error:", err);
      return interaction.reply({ content: "❌ Lỗi khi tạo giveaway.", ephemeral: true });
    }
  }
};
