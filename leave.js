module.exports = {
    name: "leave",
    description: "Bot rời kênh thoại",
    async execute(client, message) {
        const queue = client.player.getQueue(message.guild.id);
        if (!queue) return message.reply("⚠️ Bot hiện không phát nhạc.");

        queue.destroy();
        return message.reply("👋 Bot đã rời kênh thoại.");
    }
};
