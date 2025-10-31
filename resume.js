module.exports = {
    name: "resume",
    description: "Tiếp tục phát nhạc",
    execute(client, message) {
        const queue = client.player.getQueue(message.guild.id);
        if (!queue || !queue.playing) return message.reply("❌ Nhạc đã phát hoặc không có bài!");

        queue.setPaused(false);
        return message.reply("▶️ Tiếp tục phát nhạc!");
    }
};
