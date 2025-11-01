module.exports = {
  name: "ready",
  once: true,
  execute(client) {
    console.log(`✅ Đăng nhập thành công: ${client.user.tag}`);
    client.user.setActivity("💬 đang trò chuyện cùng bạn~");
  },
};
