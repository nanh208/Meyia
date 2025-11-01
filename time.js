// src/utils/time.js
function parseTime(str) {
  const m = /^(\d+)([smhd])$/.exec(str);
  if (!m) return null;
  const map = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return parseInt(m[1]) * map[m[2]];
}
module.exports = { parseTime };
