// commands/auto.js
// Toggle chế độ auto: bot tự tìm random nhạc khi queue trống
module.exports = {
  name: "auto",
  description: "Bật/tắt chế độ auto: bot tự tìm và phát nhạc ngẫu nhiên khi queue trống.",
  async execute(message, args) {
    const client = message.client;
    const guildId = message.guild.id;
    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) return message.reply("❗ Bạn phải vào kênh thoại trước khi bật auto.");

    // ensure map tồn tại
    if (!client._autoSchedulers) client._autoSchedulers = new Map();

    // toggle
    if (client._autoSchedulers.has(guildId)) {
      // disable
      const data = client._autoSchedulers.get(guildId);
      clearInterval(data.interval);
      client._autoSchedulers.delete(guildId);
      return message.reply("⛔ Đã tắt chế độ auto cho server này.");
    }

    // enable: create player and connect
    try {
      const player = client.manager.create({
        guild: guildId,
        voiceChannel: voiceChannel.id,
        textChannel: message.channel.id,
        selfDeafen: true
      });

      if (player.state !== "CONNECTED") await player.connect();

      // list từ khóa ngẫu nhiên (bạn có thể mở rộng)
      const randomQueries = [
        "pop hits 2024",
        "lofi hip hop",
        "top 100 vietnam",
        "edm bangers",
        "kpop hits",
        "acoustic chill",
        "relaxing piano",
        "anime ost",
        "vietnam bolero",
        "rap hits"
      ];

      // scheduler: kiểm tra mỗi 25s nếu queue trống -> tìm track và thêm
      const interval = setInterval(async () => {
        try {
          // nếu player bị destroy thì dừng scheduler
          if (!client.manager.players.has(guildId)) {
            clearInterval(interval);
            client._autoSchedulers.delete(guildId);
            return;
          }

          const q = client.manager.players.get(guildId);
          // nếu queue rỗng hoặc không chơi
          if (!q || (!q.playing && q.queue.length === 0)) {
            // chọn query random
            const query = randomQueries[Math.floor(Math.random() * randomQueries.length)];
            const res = await client.manager.search(query, message.author);

            if (!res || res.loadType === "NO_MATCHES" || res.loadType === "LOAD_FAILED") {
              return; // thử lần sau
            }

            let trackToAdd = null;
            if (res.loadType === "PLAYLIST_LOADED") {
              // thêm toàn bộ playlist (hoặc chỉ thêm top 3 để tránh spam)
              q.queue.add(res.tracks.slice(0, 5));
              trackToAdd = q.queue[0];
            } else {
              trackToAdd = res.tracks[0];
              q.queue.add(trackToAdd);
            }

            if (!q.playing) q.play();
            // thông báo nhẹ nhàng (không spam)
            try {
              const textCh = client.channels.cache.get(message.channel.id);
              if (textCh) textCh.send(`🎧 Auto: đã thêm **${trackToAdd.title}** vào queue.`).catch(()=>{});
            } catch(e){}
          }
        } catch (e) {
          console.error("Auto scheduler error:", e);
        }
      }, 25000); // 25 giây

      // lưu scheduler
      client._autoSchedulers.set(guildId, { interval, channel: message.channel.id });
      return message.reply("✅ Đã bật chế độ auto. Bot sẽ tự động thêm nhạc khi queue trống.");
    } catch (err) {
      console.error("Auto command error:", err);
      return message.reply("❌ Không thể bật auto (kiểm tra quyền hoặc kết nối Lavalink).");
    }
  }
};
