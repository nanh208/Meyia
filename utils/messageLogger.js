// utils/messageLogger.js
module.exports = (client) => {
  // create table if not exists
  client.db.prepare(`CREATE TABLE IF NOT EXISTS messages (guild_id TEXT, user_id TEXT, count INTEGER, PRIMARY KEY (guild_id, user_id))`).run();

  client.on("messageCreate", (message) => {
    if (message.author.bot) return;
    if (!message.guild) return;
    try {
      const stmt = client.db.prepare("SELECT count FROM messages WHERE guild_id = ? AND user_id = ?");
      const row = stmt.get(message.guild.id, message.author.id);
      if (!row) {
        client.db.prepare("INSERT INTO messages (guild_id, user_id, count) VALUES (?, ?, ?)").run(message.guild.id, message.author.id, 1);
      } else {
        client.db.prepare("UPDATE messages SET count = count + 1 WHERE guild_id = ? AND user_id = ?").run(message.guild.id, message.author.id);
      }
    } catch (err) {
      console.error("MessageLogger error:", err);
    }
  });
};
