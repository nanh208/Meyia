module.exports = {
    name: "queue",
    description: "Xem danh sách phát",
    execute(client, message) {
        const queue = client.player.getQueue(message.guild.id);
        if (!queue) return message.reply("📭 Queue đang trống!");

        const tracks = queue.tracks.slice(0, 10).map((t, i) => `**${i+1}.** ${t.title}`).join("\n");
        message.reply(`🎶 **Đang phát:** ${queue.current.title}\n\n📜 **Danh sách:**\n${tracks}`);
    }
};
