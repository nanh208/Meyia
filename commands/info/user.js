const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
module.exports = {
  data: new SlashCommandBuilder().setName("userinfo").setDescription("ℹ️ Thông tin người dùng")
    .addUserOption(o => o.setName("thành_viên").setDescription("Chọn người (mặc định là bạn)").setRequired(false)),
  async execute(interaction) {
    const user = interaction.options.getUser("thành_viên") || interaction.user;
    const member = interaction.guild.members.cache.get(user.id) || await interaction.guild.members.fetch(user.id).catch(()=>null);
    const e = new EmbedBuilder()
      .setTitle(`${user.tag}`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .setColor("#ffd6e0")
      .addFields(
        { name: "ID", value: user.id, inline: true },
        { name: "Tạo tài khoản", value: `<t:${Math.floor(user.createdTimestamp/1000)}:R>`, inline: true },
        { name: "Tham gia server", value: member ? `<t:${Math.floor(member.joinedTimestamp/1000)}:R>` : "Không có", inline: true }
      );
    await interaction.reply({ embeds: [e] });
  }
};
