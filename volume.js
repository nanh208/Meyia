module.exports = {
    name: "volume",
    description: "Điều chỉnh âm lượng",
    execute(client, message, args) {
        const queue = client.player.getQueue(message.guild.id);
        if (!queue) return message.reply("❌ Không có nhạc đang phát!");

        const vol = Number(args[0]);
        if (!vol || vol < 1 || vol > 200) return message.reply("🔊 Nhập âm lượng từ **1 đến 200**.");

        queue.setVolume(vol);
        return message.reply(`✅ Âm lượng đặt thành: **${vol}%**`);
    }
};
