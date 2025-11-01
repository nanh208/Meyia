// src/utils/embeds.js
// --------------------
// Dễ tạo Embed đẹp mắt & đồng nhất

const { EmbedBuilder } = require("discord.js");

function createEmbed(title, description, color = "#FFC0CB") {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setFooter({ text: "🌸 Meyia Bot" })
    .setTimestamp();
}

function errorEmbed(text) {
  return createEmbed("⚠️ Lỗi rồi nè!", text, "#FF6961");
}

function successEmbed(text) {
  return createEmbed("✅ Thành công!", text, "#77DD77");
}

module.exports = { createEmbed, errorEmbed, successEmbed };
