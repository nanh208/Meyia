const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("📚 Hiển thị danh sách lệnh và cách sử dụng chi tiết."),

  async execute(interaction) {
    const user = interaction.user;

    // === Embed chính ===
    const mainEmbed = new EmbedBuilder()
      .setAuthor({ name: `Xin chào ${user.username}, tôi là Meyia 💖` })
      .setDescription(
        [
          "✨ Dưới đây là danh sách **danh mục lệnh** bạn có thể khám phá:",
          "",
          "🎯 **Hoạt động** — Kiểm tra cấp, top chat, hoạt động người dùng.",
          "🧭 **Thông tin** — Xem thông tin user, server, vai trò, bot.",
          "🛡️ **Quản trị** — Dành cho mod/admin (kick, ban, mute, warn...).",
          "⚙️ **Hệ thống** — Cấu hình, reload, ping, uptime, feedback.",
          "",
          "Chọn danh mục bên dưới để xem chi tiết từng lệnh nhé 💡"
        ].join("\n")
      )
      .setColor("#FFB6C1")
      .setFooter({ text: "Meyia • Trợ lý đáng yêu của bạn 💕" });

    // === Menu chọn danh mục ===
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("help-menu")
      .setPlaceholder("🔽 Chọn danh mục để xem lệnh")
      .addOptions([
        { label: "Hoạt động", value: "activity", emoji: "🎯", description: "Kiểm tra xếp hạng, top chat..." },
        { label: "Thông tin", value: "info", emoji: "🧭", description: "Xem thông tin server, user, bot..." },
        { label: "Quản trị", value: "mod", emoji: "🛡️", description: "Lệnh quản lý server, thành viên..." },
        { label: "Hệ thống", value: "system", emoji: "⚙️", description: "Lệnh cấu hình, phản hồi, tiện ích..." }
      ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    // Gửi embed chính
    const message = await interaction.reply({
      embeds: [mainEmbed],
      components: [row],
      ephemeral: true
    });

    // === Bộ sưu tập tương tác (collector) ===
    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 180000 // 3 phút
    });

    collector.on("collect", async (i) => {
      if (i.user.id !== user.id)
        return i.reply({ content: "❌ Chỉ người gọi lệnh mới có thể dùng menu này!", ephemeral: true });

      const category = i.values[0];
      let embed;

      if (category === "activity") {
        embed = new EmbedBuilder()
          .setTitle("🎯 Danh mục: Hoạt động")
          .setDescription(
            [
              "`/rank` — Xem cấp độ & XP hiện tại của bạn.",
              "`/topchat` — Hiển thị top người hoạt động nhiều nhất."
            ].join("\n")
          )
          .setColor("#FCE38A");
      }

      if (category === "info") {
        embed = new EmbedBuilder()
          .setTitle("🧭 Danh mục: Thông tin")
          .setDescription(
            [
              "`/avatar` — Xem ảnh đại diện của người dùng.",
              "`/user` — Hiển thị thông tin chi tiết về tài khoản.",
              "`/server` — Thông tin máy chủ hiện tại.",
              "`/role` — Chi tiết vai trò (permissions, màu...).",
              "`/botinfo` — Thông tin về Meyia 💖",
              "`/uptime` — Thời gian bot hoạt động."
            ].join("\n")
          )
          .setColor("#95E1D3");
      }

      if (category === "mod") {
        embed = new EmbedBuilder()
          .setTitle("🛡️ Danh mục: Quản trị viên")
          .setDescription(
            [
              "`/ban` — Cấm thành viên khỏi server.",
              "`/kick` — Đuổi thành viên ra khỏi server.",
              "`/mute` — Tắt tiếng người dùng.",
              "`/unmute` — Bỏ tắt tiếng.",
              "`/lock` — Khóa kênh hiện tại.",
              "`/unlock` — Mở khóa kênh.",
              "`/warn` — Cảnh cáo người dùng.",
              "`/clearwarns` — Xóa toàn bộ cảnh cáo.",
              "`/clear` — Xóa tin nhắn hàng loạt.",
              "`/slowmode` — Đặt chế độ chậm trong kênh."
            ].join("\n")
          )
          .setColor("#EA5455");
      }

      if (category === "system") {
        embed = new EmbedBuilder()
          .setTitle("⚙️ Danh mục: Hệ thống & Tiện ích")
          .setDescription(
            [
              "`/ping` — Kiểm tra tốc độ phản hồi bot.",
              "`/announce` — Gửi thông báo đến kênh chỉ định.",
              "`/feedback` — Gửi phản hồi đến dev.",
              "`/reload` — Tải lại tất cả lệnh mà không restart bot.",
              "`/stats` — Thống kê cơ bản của bot.",
              "`/suggest` — Gửi ý tưởng / đề xuất mới.",
              "`/report` — Báo cáo lỗi hoặc người dùng."
            ].join("\n")
          )
          .setColor("#6C5B7B");
      }

      const backButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("back").setLabel("⬅️ Quay lại").setStyle(ButtonStyle.Secondary)
      );

      await i.update({ embeds: [embed], components: [backButton] });
    });

    // === Nút quay lại ===
    const backCollector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 180000
    });

    backCollector.on("collect", async (i) => {
      if (i.customId === "back" && i.user.id === user.id) {
        await i.update({ embeds: [mainEmbed], components: [row] });
      }
    });

    // === Hết hạn ===
    collector.on("end", async () => {
      try {
        await message.edit({
          components: [],
          embeds: [
            mainEmbed.setFooter({ text: "⏳ Phiên hướng dẫn đã hết hạn, hãy gõ /help để xem lại." })
          ]
        });
      } catch (e) {}
    });
  }
};
