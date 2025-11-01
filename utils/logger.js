// src/utils/logger.js
// --------------------
// Ghi log bot ra console & gửi về kênh trong server

async function logToChannel(client, message) {
  const channelId = process.env.ACTIVITY_LOG_CHANNEL_ID;
  if (!channelId) return console.log("[LOG]", message);

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel) return console.log("[LOG]", message);
    await channel.send(`🪶 **LOG:** ${message}`);
  } catch (err) {
    console.log("[LOG_ERR]", err.message);
  }
}

module.exports = { logToChannel };
