module.exports = {
    name: "pause",
    description: "Tạm dừng nhạc",
    execute(client, message) {
        const queue = client.player.getQueue(message.guild.id);
        if (!queue || !queue.playing) return message.reply("❌ Không có bài nào đang phát!");

        queue.setPaused(true);
        return message.reply("⏸️ Đã tạm dừng.");
    }
};
