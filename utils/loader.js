// src/utils/loader.js
// --------------------
// Tự động load events từ thư mục /events

const fs = require("fs");
const path = require("path");

async function loadEvents(client) {
  const eventsPath = path.join(__dirname, "../events");
  const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith(".js"));

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }
  }

  console.log(`📁 Đã nạp ${eventFiles.length} event.`);
}

module.exports = { loadEvents };
