// src/commands/giveaway/giveaway.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { db } = require("../../utils/db");
const { parseTime } = require("../../utils/time");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("🎁 Tạo giveaway")
    .addStringOption(o => o.setName("time").setDescription("Thời gian (10m, 1h, 1d)").setRequired(true))
    .addIntegerOption(o => o.setName("winners").setDescription("Số người thắng").setRequired(true))
    .addStringOption(o => o.setName("prize").setDescription("Phần thưởng").setRequired(true)),

  async execute(interaction) {
    const timeStr = interaction.options.getString("time");
    const winners = interaction.options.getInteger("winners");
    const prize = interaction.options.getString("prize");
    const endTime = Date.now() + parseTime(timeStr);
    const MAIN_COLOR = "#FFB6C1";

    const embed = new EmbedBuilder()
      .setColor(MAIN_COLOR)
      .setTitle("🎉 GIVEAWAY 🎉")
      .setDescription(`🎁 **Phần thưởng:** ${prize}\n🏆 **Số lượng:** ${winners}\n⌛ Kết thúc sau: ${timeStr}`)
      .setFooter({ text: "Nhấn 🎉 để tham gia" });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("join_giveaway").setLabel("🎉 Tham Gia").setStyle(ButtonStyle.Success)
    );

    const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

    db.prepare(`INSERT INTO giveaways (id, channel_id, message_id, prize, winners, end_time, host_id)
                VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(msg.id, interaction.channel.id, msg.id, prize, winners, endTime, interaction.user.id);
  },
};
