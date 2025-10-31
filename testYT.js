const yts = require("yt-search");

(async () => {
  const query = process.argv[2] || "Believer Imagine Dragons";
  console.log("🔎 Đang tìm kiếm bài hát:", query);

  const r = await yts(query);
  const videos = r.videos.slice(0, 1); // lấy bài đầu tiên

  if (!videos.length) return console.log("❌ Không tìm thấy bài hát!");

  const video = videos[0];
  console.log("✅ Tìm thấy bài hát:");
  console.log("Title:", video.title);
  console.log("URL:", video.url);
  console.log("Duration:", video.timestamp);
})();
