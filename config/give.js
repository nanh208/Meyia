const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const ms = require("ms");
const path = require("path");
const Database = require("better-sqlite3");

// Đường dẫn đến database
const dbPath = path.join(__dirname, "../data/meiya.db");
const db = new Database(dbPath);

// 🧩 Tạo bảng nếu chưa tồn tại
db.prepare(`
  CREATE TABLE IF NOT EXISTS giveaways (
    id TEXT PRIMARY KEY,
    messageId TEXT,
    channelId TEXT,
    guildId TEXT,
    prize TEXT,
    winners INTEGER,
    endTime INTEGER,
    hostId TEXT,
    ended INTEGER
  )
`).run();

module.exports = {
  data: new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("🎉 Tạo một sự kiện Giveaway cực xịn!")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((opt) =>
      opt
        .setName("thời_gian")
        .setDescription("⏰ Thời gian (ví dụ: 10m, 1h, 2d)")
        .setRequired(true)
    )
    .addIntegerOption((opt) =>
      opt
        .setName("số_lượng")
        .setDescription("🏆 Số lượng người chiến thắng")
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("phần_thưởng")
        .setDescription("🎁 Phần thưởng cho giveaway")
        .setRequired(true)
    ),

  async execute(interaction) {
    try {
      const timeInput = interaction.options.getString("thời_gian");
      const winnerCount = interaction.options.getInteger("số_lượng");
      const prize = interaction.options.getString("phần_thưởng");
      const duration = ms(timeInput);

      if (!duration)
        return interaction.reply({
          content: "❌ Thời gian không hợp lệ! Ví dụ: `10m`, `2h`, `1d`",
          ephemeral: true,
        });

      const endTime = Date.now() + duration;
      const giveawayId = Math.random().toString(36).substring(2, 8).toUpperCase();

      // 🧱 Embed chính của giveaway
      const embed = new EmbedBuilder()
        .setColor("#ff007f")
        .setTitle(
          `<a:1255341894687260775:1433317867293642858> **GIVEAWAY** <a:1255341894687260775:1433317867293642858>`
        )
        .setDescription(
          `🎁 **PHẦN THƯỞNG:** 🎉 **__${prize}__**\n\n` +
            `<a:12553406462486160061:1433317989406605383> **SỐ LƯỢNG GIẢI:** ${winnerCount}\n` +
            `<a:12553406462486160061:1433317989406605383> **THỜI GIAN:** ${timeInput}\n` +
            `👑 **NGƯỜI TỔ CHỨC:** ${interaction.user}\n` +
            `📛 **MÃ GIVEAWAY:** ${giveawayId}\n\n` +
            `<a:12553406462486160061:1433317989406605383> Mọi người bấm vào emoji <a:1261960933270618192:1433286685189341204> để tham gia nha!\n\n` +
            `> Giveaway sẽ kết thúc vào: <t:${Math.floor(endTime / 1000)}:F>`
        )
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true })) // ảnh người tạo nhỏ bên phải
        .setImage(interaction.client.user.displayAvatarURL({ dynamic: true, size: 512 })) // ảnh bot to bên dưới
        .setFooter({
          text: `Mã sự kiện: ${giveawayId}`,
        });

      const msg = await interaction.reply({
        embeds: [embed],
        fetchReply: true,
      });

      await msg.react("<a:1261960933270618192:1433286685189341204>");

      // 🧩 Lưu vào database
      db.prepare(
        `INSERT INTO giveaways (id, messageId, channelId, guildId, prize, winners, endTime, hostId, ended)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`
      ).run(
        giveawayId,
        msg.id,
        interaction.channel.id,
        interaction.guild.id,
        prize,
        winnerCount,
        endTime,
        interaction.user.id
      );

      interaction.followUp({
        content: "✅ Giveaway đã được tạo thành công!",
        ephemeral: true,
      });

      // ⏳ Countdown tự kết thúc
      setTimeout(async () => {
        try {
          const fetchMsg = await interaction.channel.messages.fetch(msg.id);
          const reaction = fetchMsg.reactions.cache.get(
            "a:1261960933270618192:1433286685189341204"
          );
          const users = reaction ? await reaction.users.fetch() : [];
          const valid = users.filter((u) => !u.bot);

          const winners = valid.random(winnerCount);

          const endEmbed = new EmbedBuilder()
            .setColor("#ff007f")
            .setTitle(
              `<a:1255341894687260775:1433317867293642858> GIVEAWAY KẾT THÚC <a:12553406462486160061:1433317989406605383>`
            )
            .setDescription(
              `🎁 **Phần thưởng:** ${prize}\n\n` +
                `${
                  winners.length
                    ? `🏆 **Người chiến thắng:** ${winners
                        .map((u) => `<@${u.id}>`)
                        .join(", ")}`
                    : "❌ Không có ai tham gia!"
                }\n\n` +
                `👑 **Người tổ chức:** ${interaction.user}\n📛 **Mã giveaway:** ${giveawayId}`
            )
            .setThumbnail(
              interaction.user.displayAvatarURL({ dynamic: true })
            )
            .setImage(
              interaction.client.user.displayAvatarURL({
                dynamic: true,
                size: 512,
              })
            );

          await fetchMsg.edit({ embeds: [endEmbed] });
          db.prepare(`UPDATE giveaways SET ended = 1 WHERE id = ?`).run(
            giveawayId
          );

          if (winners.length > 0) {
            interaction.channel.send(
              `🎊 Chúc mừng ${winners
                .map((u) => `<@${u.id}>`)
                .join(", ")} đã thắng **${prize}**!`
            );
          }
        } catch (e) {
          console.error("Lỗi khi kết thúc giveaway:", e);
        }
      }, duration);
    } catch (err) {
      console.error("Giveaway error:", err);
      return interaction.reply({
        content: "❌ Đã xảy ra lỗi khi tạo giveaway.",
        ephemeral: true,
      });
    }
  },
};

// 🕒 Khi bot bật lại — kiểm tra và kết thúc giveaway đã hết hạn
module.exports.restoreGiveaways = (client) => {
  const now = Date.now();
  const giveaways = db
    .prepare("SELECT * FROM giveaways WHERE ended = 0")
    .all();

  for (const g of giveaways) {
    const timeLeft = g.endTime - now;

    if (timeLeft <= 0) {
      // Hết thời gian → xử lý kết thúc ngay
      const channel = client.channels.cache.get(g.channelId);
      if (!channel) continue;

      channel.messages
        .fetch(g.messageId)
        .then(async (msg) => {
          const reaction = msg.reactions.cache.get(
            "a:1261960933270618192:1433286685189341204"
          );
          const users = reaction ? await reaction.users.fetch() : [];
          const valid = users.filter((u) => !u.bot);
          const winners = valid.random(g.winners);

          const endEmbed = new EmbedBuilder()
            .setColor("#ff007f")
            .setTitle(
              `<a:1255341894687260775:1433317867293642858> GIVEAWAY KẾT THÚC <a:12553406462486160061:1433317989406605383>`
            )
            .setDescription(
              `🎁 **Phần thưởng:** ${g.prize}\n\n` +
                `${
                  winners.length
                    ? `🏆 **Người chiến thắng:** ${winners
                        .map((u) => `<@${u.id}>`)
                        .join(", ")}`
                    : "❌ Không có ai tham gia!"
                }\n\n` +
                `👑 **Người tổ chức:** <@${g.hostId}>\n📛 **Mã giveaway:** ${g.id}`
            )
            .setThumbnail(
              client.users.cache.get(g.hostId)?.displayAvatarURL({
                dynamic: true,
              })
            )
            .setImage(
              client.user.displayAvatarURL({ dynamic: true, size: 512 })
            );

          await msg.edit({ embeds: [endEmbed] });
          db.prepare(`UPDATE giveaways SET ended = 1 WHERE id = ?`).run(g.id);

          if (winners.length > 0)
            channel.send(
              `🎊 Chúc mừng ${winners
                .map((u) => `<@${u.id}>`)
                .join(", ")} đã thắng **${g.prize}**!`
            );
        })
        .catch(() => {});
    } else {
      // Còn thời gian → hẹn giờ kết thúc
      setTimeout(() => {
        module.exports.restoreGiveaways(client);
      }, timeLeft);
    }
  }
};
