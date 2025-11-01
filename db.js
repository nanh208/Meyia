// src/utils/db.js
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const dbDir = path.join(__dirname, "../../database");
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
const dbPath = path.join(dbDir, "data.db");
const db = new Database(dbPath);

db.prepare(`CREATE TABLE IF NOT EXISTS warnings (...)`).run();
db.prepare(`CREATE TABLE IF NOT EXISTS reminders (...)`).run();
db.prepare(`CREATE TABLE IF NOT EXISTS guild_config (...)`).run();
db.prepare(`CREATE TABLE IF NOT EXISTS giveaways (...)`).run();

async function loadReminders(client) {
  const now = Date.now();
  const rows = db.prepare(`SELECT * FROM reminders WHERE remindAt > ?`).all(now);
  for (const r of rows) {
    const delay = r.remindAt - now;
    setTimeout(async () => {
      const user = await client.users.fetch(r.userId).catch(() => null);
      if (user) await user.send(`🔔 Reminder: ${r.message}`).catch(() => {});
      db.prepare("DELETE FROM reminders WHERE id=?").run(r.id);
    }, delay);
  }
}

module.exports = { db, loadReminders };
