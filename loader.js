const fs = require("fs");
const path = require("path");

function loadEvents(client) {
  const eventFiles = fs.readdirSync(path.join(__dirname, "../events"));
  for (const file of eventFiles) {
    const event = require(`../events/${file}`);
    const eventName = file.split(".")[0];
    if (event.once) {
      client.once(eventName, (...args) => event.execute(...args, client));
    } else {
      client.on(eventName, (...args) => event.execute(...args, client));
    }
  }
}

module.exports = { loadEvents };
