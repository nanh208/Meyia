// utils/playerSetup.js — Discord Player v6.7+ compatible
const { Player } = require("discord-player");
const { DefaultExtractors } = require("@discord-player/extractor");
const { EmbedBuilder } = require("discord.js");

async function setupPlayer(client) {
  const player = new Player(client, {
    ytdlOptions: {
      quality: "highestaudio",
      highWaterMark: 1 << 25,
    },
  });

  try {
    // ✅ Cách mới để nạp extractor (thay cho loadDefault)
    await player.extractors.loadMulti(DefaultExtractors);
    console.log("🎵 Default music extractors loaded successfully!");
  } catch (err) {
    console.error("❌ Failed to register music extractors:", err);
  }

  // 🎧 Sự kiện khi bắt đầu phát
  player.events.on("playerStart", (queue, track) => {
    const channel = queue.metadata;
    const embed = new EmbedBuilder()
      .setColor(client.MAIN_COLOR)
      .setTitle("🎶 Đang phát")
      .setDescription(`[${track.title}](${track.url})`)
      .addFields(
        { name: "⏱️ Thời lượng", value: track.duration, inline: true },
        { name: "👤 Yêu cầu bởi", value: track.requestedBy?.tag || "Không rõ", inline: true }
      );
    channel.send({ embeds: [embed] }).catch(() => {});
  });

  player.events.on("trackAdd", (queue, track) => {
    const channel = queue.metadata;
    channel.send(`✅ Đã thêm **${track.title}** vào hàng đợi!`).catch(() => {});
  });

  player.events.on("tracksAdd", (queue, tracks) => {
    const channel = queue.metadata;
    channel.send(`📚 Đã thêm **${tracks.length}** bài từ playlist vào hàng đợi!`).catch(() => {});
  });

  player.events.on("error", (queue, error) =>
    console.log(`❌ Lỗi phát nhạc: ${error.message}`)
  );
  player.events.on("connectionError", (queue, error) =>
    console.log(`🔗 Lỗi kết nối: ${error.message}`)
  );

  client.player = player;
}

module.exports = { setupPlayer };
