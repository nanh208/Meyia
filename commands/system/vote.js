const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("vote")
    .setDescription("⭐ Ủng hộ bot bằng cách vote!"),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor("#ff70d3")
      .setTitle("⭐ Vote cho Meyia Bot")
      .setDescription(`
Cảm ơn bạn vì đã ủng hộ 💖  
- [Top.gg](https://top.gg/bot/yourbotid/vote)  
- [DiscordBotList](https://discordbotlist.com/bots/yourbotid/upvote)
`)
      .setFooter({ text: "Mỗi lượt vote là một sự ủng hộ lớn 💪" });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
