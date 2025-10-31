if (cmd === "play") {
  const query = interaction.options.getString("query");
  const memberVoice = interaction.member?.voice?.channel;
  if (!memberVoice) return interaction.reply({ content: "❗ Bạn phải vào kênh thoại trước!", ephemeral: true });
  
  await interaction.deferReply();

  try {
    // Search nhạc tự động
    const search = await client.player.search(query, {
      requestedBy: interaction.user,
      searchEngine: QueryType.AUTO // tự động chọn YouTube / YouTube Music
    });

    if (!search || !search.tracks.length) return interaction.editReply("❌ Không tìm thấy bài hát!");

    // Tạo queue
    const queue = await client.player.createQueue(interaction.guild, {
      metadata: { channel: interaction.channel },
      leaveOnEnd: true,
      leaveOnStop: true,
      leaveOnEmpty: true
    });

    // Kết nối voice nếu chưa kết nối
    try {
      if (!queue.connection) await queue.connect(memberVoice);
    } catch {
      client.player.deleteQueue(interaction.guild.id);
      return interaction.editReply("⚠️ Bot không thể vào voice (kiểm tra quyền Connect).");
    }

    // Thêm track vào queue
    if (search.playlist) queue.addTracks(search.tracks);
    else queue.addTrack(search.tracks[0]);

    // Bắt đầu phát nếu chưa phát
    if (!queue.playing) await queue.play();

    const track = queue.current;
    return interaction.editReply(`🎶 Đang phát: **${track.title}** — yêu cầu bởi ${interaction.user}`);
    
  } catch (err) {
    console.error("Play command error:", err);
    return interaction.editReply("❌ Lỗi khi phát nhạc.");
  }
}