const { EmbedBuilder } = require("discord.js");

/**
 * Hàm hẹn giờ kết thúc giveaway
 * @param {Client} client 
 * @param {Message} msg 
 * @param {number} endTime 
 * @param {number} winnerCount 
 * @param {string} prize 
 */
async function scheduleGiveaway(client, msg, endTime, winnerCount, prize) {
  const duration = endTime - Date.now();
  if (duration <= 0) return;

  setTimeout(async () => {
    try {
      // ✅ Kiểm tra cache & fetch lại message nếu cần
      if (!msg.reactions?.cache?.size) {
        try {
          msg = await msg.channel.messages.fetch(msg.id);
        } catch {
          console.warn(`⚠️ Không thể fetch lại message ${msg.id}`);
          return;
        }
      }

      // ✅ Lấy emoji chính xác
      const reaction = msg.reactions.cache.get("🎉") || msg.reactions.cache.first();
      if (!reaction) {
        console.warn(`⚠️ Không tìm thấy reaction 🎉 trong giveaway ${msg.id}`);
        return;
      }

      await reaction.users.fetch(); // tải toàn bộ người tham gia
      const participants = reaction.users.cache.filter(u => !u.bot);

      let winners = [];
      if (participants.size > 0) {
        const arr = Array.from(participants.keys());
        for (let i = 0; i < winnerCount && arr.length > 0; i++) {
          const idx = Math.floor(Math.random() * arr.length);
          winners.push(arr.splice(idx, 1)[0]);
        }
      }

      // 🎁 Gửi embed kết thúc (giữ nguyên icon & style của bạn)
      const endEmbed = new EmbedBuilder()
        .setColor("#ff70d3")
        .setTitle(`<a:1255341894687260775:1433317867293642858> GIVEAWAY KẾT THÚC <a:1255340646248616061:1433317989406605383>`)
        .setDescription(
          `🎁 **Phần thưởng:** ${prize}\n\n` +
          `${winners.length ? `🏆 **Người chiến thắng:** ${winners.map(id => `<@${id}>`).join(", ")}` : "❌ Không có ai tham gia!"}`
        )
        .setTimestamp();

      await msg.edit({ embeds: [endEmbed] }).catch(() => {});

      if (winners.length > 0) {
        await msg.channel.send(
          `🎉 Chúc mừng ${winners.map(id => `<@${id}>`).join(", ")} đã chiến thắng **${prize}**!`
        ).catch(() => {});
      }

      // 🧹 Xóa khỏi DB khi kết thúc
      if (client.db) {
        try {
          client.db.prepare("DELETE FROM giveaways WHERE message_id = ?").run(msg.id);
        } catch (err) {
          console.error("⚠️ Lỗi khi xóa giveaway khỏi DB:", err);
        }
      }

    } catch (err) {
      console.error("❌ Giveaway end error:", err);
    }
  }, duration);
}

module.exports = { scheduleGiveaway };
