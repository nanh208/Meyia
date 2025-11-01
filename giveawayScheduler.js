const { EmbedBuilder } = require("discord.js");

function scheduleGiveaway(client, msg, endTime, numWinners, prize) {
  const timeout = endTime - Date.now();
  if (timeout <= 0) return;

  setTimeout(async () => {
    try {
      await msg.fetch();
      const users = (await msg.reactions.cache.get("🎉")?.users.fetch())?.filter(u => !u.bot) || [];
      if (users.size === 0) {
        return msg.reply("❌ Không có ai tham gia giveaway này!");
      }

      const winners = [...users.values()].sort(() => Math.random() - 0.5).slice(0, numWinners);
      const winnerMentions = winners.map(u => `<@${u.id}>`).join(", ");

      const resultEmbed = new EmbedBuilder()
        .setColor("#ffd166")
        .setTitle("🎉 GIVEAWAY KẾT THÚC!")
        .setDescription(`🎁 **Phần thưởng:** ${prize}\n👑 **Người chiến thắng:** ${winnerMentions}`)
        .setTimestamp();

      await msg.edit({ embeds: [resultEmbed], components: [] });
      await msg.reply(`🎊 Chúc mừng ${winnerMentions} đã thắng **${prize}**!`);

      client.db.prepare("DELETE FROM giveaways WHERE id = ?").run(msg.id);
    } catch (err) {
      console.error("Giveaway end error:", err);
    }
  }, timeout);
}

module.exports = { scheduleGiveaway };
