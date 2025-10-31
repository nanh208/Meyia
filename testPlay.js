require("dotenv").config();
const { Player, QueryType } = require("discord-player");
const playdl = require("play-dl");

(async () => {
  try {
    const query = process.argv[2] || "Believer"; // Tên bài hát hoặc link
    console.log("🔎 Đang tìm kiếm bài hát:", query);

    const trackSearch = await playdl.search(query, { limit: 1, source: "ytmsearch" });

    if (!trackSearch.length) {
      console.log("❌ Không tìm thấy bài hát!");
      return;
    }

    const track = trackSearch[0];
    console.log("✅ Tìm thấy bài hát:");
    console.log("Title:", track.title);
    console.log("URL:", track.url);
    console.log("Duration:", track.durationRaw);
  } catch (err) {
    console.error("❌ Lỗi khi tìm bài hát:", err);
  }
})();
