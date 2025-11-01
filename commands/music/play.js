// commands/music/play.js — Robust /play (plays a fixed link or can be adapted)
const { SlashCommandBuilder, PermissionsBitField } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Phát bài nhạc cố định (Stay) — bot chỉ phát duy nhất link đã cấu hình"),
  // nếu bạn muốn cho người dùng nhập query, thêm option string ở đây

  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: false });

    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
      return interaction.editReply("❌ Bạn phải ở trong kênh thoại để phát nhạc.");
    }

    // Check bot permissions in that channel
    const botMember = interaction.guild.members.me;
    const perms = voiceChannel.permissionsFor ? voiceChannel.permissionsFor(botMember) : null;
    if (!perms || !perms.has(PermissionsBitField.Flags.Connect) || !perms.has(PermissionsBitField.Flags.Speak)) {
      return interaction.editReply("❌ Bot cần quyền `CONNECT` và `SPEAK` trong kênh thoại này.");
    }

    // FIXED LINK — bạn yêu cầu chỉ phát duy nhất link này
    const fixedLink = "https://www.youtube.com/watch?v=yWHrYNP6j4k"; // Stay (The Kid LAROI & Justin Bieber)

    const player = client.player;
    if (!player) return interaction.editReply("❌ Player chưa được khởi tạo. Vui lòng thử khởi động lại bot.");

    // create or get queue (discord-player v6+ nodes API)
    let queue = player.nodes.get(interaction.guildId);
    if (!queue) {
      queue = player.nodes.create(interaction.guild, {
        metadata: interaction.channel,
        volume: 80,
        leaveOnEnd: true,
        leaveOnEmpty: true,
        leaveOnEmptyCooldown: 300000,
      });
    }

    try {
      // Ensure the queue has a connection before attempting to play
      if (!queue.connection) {
        try {
          await queue.connect(voiceChannel);
        } catch (connErr) {
          console.error("🔗 Could not join voice channel:", connErr);
          if (queue && queue.isEmpty && typeof queue.delete === "function") queue.delete();
          return interaction.editReply("❌ Không thể kết nối tới kênh thoại. Kiểm tra quyền và thử lại.");
        }
      }

      // Search for the fixed link (use appropriate search engine automatically)
      const searchResult = await player.search(fixedLink, { requestedBy: interaction.user });
      if (!searchResult || !searchResult.tracks.length) {
        // As fallback try play-dl stream directly (in case extractor failed)
        try {
          // Use play-dl stream as fallback if available
          if (client.playdl && typeof client.playdl.stream === "function") {
            const stream = await client.playdl.stream(fixedLink).catch(() => null);
            if (stream && stream.stream) {
              // Create a fake track via player.createTrack? Simpler: let player.search find it; if not, inform user
              // For simplicity: inform user extractor failed
              console.error("⚠️ Extractor failed to find track but play-dl had a stream (not auto-added).");
            }
          }
        } catch (fallbackErr) {
          console.warn("⚠️ Fallback stream attempt failed:", fallbackErr?.message ?? fallbackErr);
        }

        if (queue.isEmpty() && !queue.isPlaying()) queue.delete();
        return interaction.editReply("😢 Không tìm thấy bài cố định (extractor không trả về track).");
      }

      // Add track(s) to queue
      queue.addTrack(searchResult.tracks);

      // Play if not playing
      if (!queue.isPlaying()) {
        // wrap play call with try/catch to catch immediate playback errors
        try {
          await queue.node.play();
        } catch (playErr) {
          console.error("❌ Error when starting playback:", playErr);
          // Cleanup if needed
          if (queue && queue.isEmpty && typeof queue.delete === "function") queue.delete();
          return interaction.editReply("⚠️ Không thể bắt đầu phát nhạc. Hãy thử lại sau.");
        }
      }

      // Success response (title available from searchResult.tracks[0])
      const title = searchResult.tracks[0]?.title ?? "Bài nhạc";
      await interaction.editReply(`🎶 Đang thêm và phát: **${title}**`);
    } catch (err) {
      // Generic catch — print error and try best-effort cleanup
      console.error("❌ Music error (catch):", err);
      try {
        if (queue && queue.isEmpty && typeof queue.delete === "function") queue.delete();
      } catch (cleanupErr) {
        console.warn("⚠️ Cleanup error:", cleanupErr);
      }
      // Friendly, actionable message to user (no raw stack)
      return interaction.editReply("⚠️ Có lỗi xảy ra khi phát nhạc — đã ghi log lỗi, vui lòng thử lại hoặc báo chủ bot.");
    }
  },
};
