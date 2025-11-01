// src/utils/db.js
// --------------------
// Quản lý kết nối SQLite + hệ thống Reminder

const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "../../data.sqlite");
let db;

function connectDB() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) return reject(err);
      console.log("✅ Đã kết nối database SQLite");
      db.run(`
        CREATE TABLE IF NOT EXISTS reminders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userId TEXT,
          message TEXT,
          remindAt INTEGER
        )
      `);
      resolve(db);
    });
  });
}

function loadReminders(client) {
  if (!db) return;
  db.all("SELECT * FROM reminders", [], (err, rows) => {
    if (err) return console.error(err);
    const now = Date.now();
    rows.forEach((r) => {
      const delay = r.remindAt - now;
      if (delay > 0) {
        setTimeout(async () => {
          try {
            const user = await client.users.fetch(r.userId);
            await user.send(`⏰ Nhắc bạn nè: ${r.message}`);
            db.run("DELETE FROM reminders WHERE id = ?", [r.id]);
          } catch (err) {
            console.error("❌ Lỗi gửi reminder:", err);
          }
        }, delay);
      }
    });
  });
}

module.exports = { connectDB, loadReminders, db };
