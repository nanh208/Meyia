// index.js — Meyia all-in-one (v1.3.0)
// Tác giả: bạn + hỗ trợ từ ChatGPT
// Yêu cầu: node 18+, discord.js v14, openai package, dotenv, ms, discord-giveaways

const {
  Client,
  Events,
  GatewayIntentBits,
  ApplicationCommandOptionType,
  EmbedBuilder,
  PermissionFlagsBits
} = require("discord.js");
const { GiveawaysManager } = require("discord-giveaways");
const ms = require("ms");
require("dotenv").config();
const { OpenAI } = require("openai");

// -------------------------
// ⚙️ CẤU HÌNH & KHỞI TẠO
// -------------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions
  ]
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const OWNER_ID = process.env.OWNER_ID || "1409222785154416651";

// Kênh active
let activeChatChannel = null;
let activeCuteChannel = null;

// Mute
let mutedChannels = new Set();

// Bộ nhớ ngắn hạn trong RAM
const channelHistories = new Map(); // channelId -> array of last messages (objects {id, authorId, content, timestamp})
const lastResponseTime = new Map(); // channelId -> timestamp of last bot reply (anti spam)
const messagesSinceMention = new Map(); // channelId -> count messages since last mention
const passiveChecksDone = new Map(); // channelId -> number of 10-message passive checks already done (max 3)

// các map cho việc tính toán reading attempts etc
const lastPassiveCheckIndex = new Map(); // channelId -> last count mod 10 processed

// THAM SỐ
const MAX_HISTORY = 15; // lưu 15 tin nhắn gần nhất
const READ_ON_MENTION = 5; // đọc 5 tin nhắn khi có nhắc tên
const PASSIVE_INTERVAL = 10; // mỗi 10 tin nhắn ko nhắc -> 30% chance
const PASSIVE_MAX_TRIES = 3; // tối đa 3 lần kiểm tra
const ANTI_SPAM_MS = 5000; // 5s giữa các phản hồi bot trong cùng kênh

// -------------------------
// ⏰ HÀM TIỆN ÍCH
// -------------------------
function formatTime(msTime) {
  if (msTime <= 0) return "0 giây";
  const seconds = Math.floor((msTime / 1000) % 60);
  const minutes = Math.floor((msTime / (1000 * 60)) % 60);
  const hours = Math.floor((msTime / (1000 * 60 * 60)) % 24);
  const days = Math.floor(msTime / (1000 * 60 * 60 * 24));
  const parts = [];
  if (days) parts.push(`${days} ngày`);
  if (hours) parts.push(`${hours} giờ`);
  if (minutes) parts.push(`${minutes} phút`);
  if (seconds) parts.push(`${seconds} giây`);
  return parts.join(", ");
}

// loại bỏ dấu tiếng Việt và chuẩn hoá chữ để check mention không phân biệt dấu/hoa
function normalizeText(s) {
  if (!s) return "";
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function containsBotName(raw) {
  // kiểm tra "meyia" trong chuỗi không phân biệt dấu/hoa
  const norm = normalizeText(raw);
  // một số cách gọi: "meyia", "meyia ơi", "meyia!", "ê meyia", "mèyia" (dấu đã removed)
  return /\bmeyia\b/.test(norm);
}

// lưu lịch sử tin nhắn cho kênh (chỉ giữ MAX_HISTORY)
function pushChannelHistory(channelId, msgObj) {
  const arr = channelHistories.get(channelId) || [];
  arr.push(msgObj);
  while (arr.length > MAX_HISTORY) arr.shift();
  channelHistories.set(channelId, arr);
}

// Lấy N tin nhắn trước đó (loại bỏ bot message nếu muốn)
function getRecentMessages(channelId, n = 5) {
  const arr = channelHistories.get(channelId) || [];
  // lấy n tin gần nhất (cuối mảng)
  return arr.slice(-n);
}

// đặt trạng thái active chat/cute
function setActiveChat(channelId) { activeChatChannel = channelId; resetChannelMemory(channelId); }
function setActiveCute(channelId) { activeCuteChannel = channelId; resetChannelMemory(channelId); }

// reset bộ đếm / memory khi bật kênh
function resetChannelMemory(channelId) {
  channelHistories.set(channelId, []);
  messagesSinceMention.set(channelId, 0);
  passiveChecksDone.set(channelId, 0);
  lastResponseTime.set(channelId, 0);
  lastPassiveCheckIndex.set(channelId, 0);
}

// mute / unmute
function muteChannel(channelId) { mutedChannels.add(channelId); }
function unmuteChannel(channelId) { mutedChannels.delete(channelId); }

// get status string
function getStatusString() {
  return `📡 **Trạng thái bot:**\n` +
    `🧠 Chat AI: ${activeChatChannel ? `<#${activeChatChannel}>` : "❌ Chưa bật"}\n` +
    `💖 BotCute: ${activeCuteChannel ? `<#${activeCuteChannel}>` : "❌ Chưa bật"}\n` +
    `🔇 Đang tắt chat: ${mutedChannels.size ? Array.from(mutedChannels).map(id => `<#${id}>`).join(", ") : "Không"}`;
}

// -------------------------
// 🎁 GIVEAWAY MANAGER (giữ nguyên icon như yêu cầu)
// -------------------------
const manager = new GiveawaysManager(client, {
  storage: "./giveaways.json",
  default: {
    botsCanWin: false,
    embedColor: "#FF69B4",
    embedColorEnd: "#000000",
    reaction: "<a:1261960933270618192:1433286685189341204>",
    winnerCount: 1
  }
});
client.giveawaysManager = manager;

// -------------------------
// 🚀 KHỞI ĐỘNG BOT & ĐĂNG LỆNH SLASH
// -------------------------
client.once(Events.ClientReady, async (readyClient) => {
  console.log(`✅ Bot MEYIA đã sẵn sàng (${readyClient.user.tag})`);

  // đăng ký slash commands (gồm help, status, giveaway, avatar, chatbot, botcute, info)
  await client.application.commands.set([
    { name: "help", description: "Xem tất cả các lệnh của Meyia" },
    { name: "status", description: "Xem trạng thái hiện tại của bot" },
    {
      name: "giveaway",
      description: "Tạo giveaway mới",
      options: [
        { name: "time", description: "Thời gian (vd: 1m, 1h, 1d)", type: ApplicationCommandOptionType.String, required: true },
        { name: "winners", description: "Số người thắng", type: ApplicationCommandOptionType.Integer, required: true },
        { name: "prize", description: "Phần thưởng", type: ApplicationCommandOptionType.String, required: true }
      ]
    },
    { name: "avatar", description: "Xem avatar của ai đó hoặc chính bạn", options: [{ name: "user", description: "Người dùng cần xem", type: ApplicationCommandOptionType.User, required: false }] },
    { name: "chatbot", description: "Thiết lập kênh chat cho Meyia", options: [{ name: "kenh", description: "Chọn kênh bot sẽ chat", type: ApplicationCommandOptionType.Channel, required: true }] },
    { name: "botcute", description: "Thiết lập kênh trò chuyện đáng yêu riêng biệt cho Meyia", options: [{ name: "kenh", description: "Chọn kênh botcute sẽ chat", type: ApplicationCommandOptionType.Channel, required: true }] },
    { name: "info", description: "Xem thông tin chi tiết về bot Meyia" }
  ]);

  console.log("✅ Slash commands đã đăng ký!");
});

// -------------------------
// 🎯 XỬ LÝ SLASH COMMANDS
// -------------------------
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // HELP
  if (interaction.commandName === "help") {
    const embed = new EmbedBuilder()
      .setColor("#FFC0CB")
      .setTitle("📜 Lệnh của Meyia")
      .setDescription(`
**🎀 Giveaway**
\`/giveaway\` – Tạo giveaway mới  

**💬 Chatbot**
\`/chatbot\` – Thiết lập kênh để Meyia trò chuyện  
\`/botcute\` – Kênh trò chuyện đáng yêu riêng biệt  
\`!mute\` – Tạm dừng chat của Meyia trong kênh  
\`!unmute\` – Gỡ mute cho kênh

**🖼️ Tiện ích**
\`/avatar\` – Xem avatar của ai đó  
\`/info\` – Xem thông tin về bot  
\`/status\` – Kiểm tra trạng thái bot  
\`!shutdown\` – Tắt bot  
\`!restart\` – Khởi động lại bot  

> 💡 Gọi Meyia bằng cách nhắc tên (ví dụ: \"Meyia ơi\", \"ê Meyia\") — không phân biệt dấu/viết hoa.
`)
      .setFooter({ text: "Meyia — đáng yêu và luôn lắng nghe 💖" });
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // STATUS
  if (interaction.commandName === "status") {
    return interaction.reply({ content: getStatusString(), ephemeral: true });
  }

  // AVATAR
  if (interaction.commandName === "avatar") {
    const user = interaction.options.getUser("user") || interaction.user;
    const avatarURL = user.displayAvatarURL({ dynamic: true, size: 1024 });
    const embed = new EmbedBuilder()
      .setColor("#FF69B4")
      .setTitle(`🖼️ Avatar của ${user.tag}`)
      .setImage(avatarURL)
      .setFooter({ text: `Yêu cầu bởi ${interaction.user.tag}` })
      .setTimestamp();
    return interaction.reply({ embeds: [embed] });
  }

  // GIVEAWAY (THAY THẾ HOÀN CHỈNH) — GIỮ NGUYÊN ICON
  if (interaction.commandName === "giveaway") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages))
      return interaction.reply({ content: "❌ Bạn không có quyền tạo giveaway!", ephemeral: true });

    const duration = ms(interaction.options.getString("time"));
    const winnerCount = interaction.options.getInteger("winners");
    const prize = interaction.options.getString("prize");
    if (!duration || duration > ms("7d"))
      return interaction.reply({ content: "❌ Thời gian không hợp lệ (tối đa 7 ngày).", ephemeral: true });

    await interaction.deferReply({ ephemeral: true });

    const code = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    const endTime = Date.now() + duration;

    // Embed khởi tạo — phần thưởng lên đầu, tiêu đề lớn
    const embed = new EmbedBuilder()
      .setColor("#FFB6C1")
      .setTitle("<a:1255341894687260775:1433317867293642858> 🎀 ＧＩＶＥＡＷＡＹ 🎀 <a:1255341894687260775:1433317867293642858>")
      .setDescription(
        `🎁 **PHẦN THƯỞNG:** **${prize}**\n\n` +
        `👑 **Người tổ chức:** ${interaction.user}\n` +
        `<a:12553406462486160061:1433317989406605383> Bấm emoji <a:1261960933270618192:1433286685189341204> để tham gia!\n\n` +
        `🎯 **Số lượng giải:** ${winnerCount}\n` +
        `⏳ **Còn lại:** ${formatTime(endTime - Date.now())}`
      )
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .setImage(interaction.client.user.displayAvatarURL({ size: 512 }))
      .setFooter({ text: `🎟️ Mã giveaway: ${code}` });

    const msg = await interaction.channel.send({ embeds: [embed] });
    // giữ nguyên icon react chính; nếu không được, sẽ log warn nhưng không đổi icon
    try {
      await msg.react("<a:1261960933270618192:1433286685189341204>");
    } catch (err) {
      console.warn("Không thể react bằng custom emoji (kiểm tra quyền hoặc emoji tồn tại).", err);
    }

    // cập nhật embed định kỳ và khi kết thúc -> xử lý winners
    const updateEmbed = async () => {
      const remaining = endTime - Date.now();
      const newEmbed = EmbedBuilder.from(embed).setDescription(
        `🎁 **PHẦN THƯỞNG:** **${prize}**\n\n` +
        `👑 **Người tổ chức:** ${interaction.user}\n` +
       `<a:sparkleheart:1433317989406605383> Bấm emoji <a:1261960933270618192:1433286685189341204> để tham gia!`+
        `🎯 **Số lượng giải:** ${winnerCount}\n` +
        `⏳ **Còn lại:** ${formatTime(Math.max(0, remaining))}`
      );
      try { await msg.edit({ embeds: [newEmbed] }); } catch (err) { console.warn("Không thể update embed:", err); }
    };

    // cập nhật ngay
    await updateEmbed();

    const countdown = setInterval(async () => {
      const remaining = endTime - Date.now();
      if (remaining <= 0) {
        clearInterval(countdown);

        // fetch message mới nhất
        let fetchedMsg;
        try { fetchedMsg = await interaction.channel.messages.fetch(msg.id); } catch (err) {
          console.error("Không fetch được message giveaway:", err);
          await interaction.followUp({ content: "❌ Đã xảy ra lỗi khi kết thúc giveaway (không fetch được tin nhắn).", ephemeral: true });
          return;
        }

        // lấy reaction (ưu tiên custom emoji id)
        const reaction = fetchedMsg.reactions.cache.get("<a:1261960933270618192:1433286685189341204>") || fetchedMsg.reactions.cache.first();
        const users = reaction ? (await reaction.users.fetch()).filter(u => !u.bot).map(u => u) : [];

        if (!users || users.length === 0) {
          const embedEnd = EmbedBuilder.from(embed)
            .setColor("#555")
            .setTitle("<a:1255341894687260775:1433317867293642858> 🎀 ＧＩＶＥＡＷＡＹ KẾT THÚC 🎀 <a:1255341894687260775:1433317867293642858>")
            .setDescription(
              `🎁 **PHẦN THƯỞNG:** **${prize}**\n\n` +
              `😢 Không có ai tham gia...\n\n` +
              `👑 **Người tổ chức:** ${interaction.user}`
            );
          await fetchedMsg.edit({ embeds: [embedEnd] });
          await fetchedMsg.reply(`😢 Không có ai tham gia giveaway **${prize}**. Mã: **${code}**`);
          await interaction.followUp({ content: `✅ Giveaway kết thúc. Không có ai tham gia.`, ephemeral: true });
          return;
        }

        const shuffled = users.sort(() => Math.random() - 0.5);
        const winners = shuffled.slice(0, Math.min(winnerCount, shuffled.length));
        const winnersText = winners.map(w => `<@${w.id}>`).join(", ");

        const embedEnd = EmbedBuilder.from(embed)
          .setColor("#00FF7F")
          .setTitle("<a:1255341894687260775:1433317867293642858> 🎉 ＧＩＶＥＡＷＡＹ ĐÃ KẾT THÚC 🎉 <a:1255341894687260775:1433317867293642858>")
          .setDescription(
            `🎁 **PHẦN THƯỞNG:** **${prize}**\n\n` +
            `🏆 **Người chiến thắng:** ${winnersText}\n\n` +
            `👑 **Người tổ chức:** ${interaction.user}`
          );

        await fetchedMsg.edit({ embeds: [embedEnd] });
        await fetchedMsg.reply(`🎊 Xin chúc mừng ${winnersText} đã thắng **${prize}**! Mã giveaway: **${code}**`);
        await interaction.followUp({ content: `✅ Giveaway kết thúc. Người thắng: ${winnersText}`, ephemeral: true });
        return;
      } else {
        await updateEmbed();
      }
    }, 10_000);

    await interaction.editReply({ content: `✅ Giveaway đã được tạo!\n💌 Mã: **${code}**` });
  }

  // CHATBOT: thiết lập kênh
  if (interaction.commandName === "chatbot") {
    const channel = interaction.options.getChannel("kenh");
    setActiveChat(channel.id);
    return interaction.reply(`✅ Meyia sẽ trò chuyện trong kênh: ${channel}`);
  }

  // BOTCUTE: thiết lập kênh cute
  if (interaction.commandName === "botcute") {
    const channel = interaction.options.getChannel("kenh");
    setActiveCute(channel.id);
    return interaction.reply(`💖 Meyia Cute sẽ trò chuyện trong kênh: ${channel}`);
  }

  // INFO (chi tiết)
  if (interaction.commandName === "info") {
    const embed = new EmbedBuilder()
      .setColor("#FFB6C1")
      .setTitle("💫 Thông tin & Hướng dẫn sử dụng Meyia")
      .setDescription(`
**🌸 Meyia — Bot trợ lý & trò chuyện**  
**Phiên bản:** 1.3.0  
**Ngày phát triển:** 30/10/2025  
**Nhà phát triển:** <@${OWNER_ID}>  

---

**📚 Tổng quan chức năng**
• \`/chatbot\` — Bật kênh chat AI chính (Meyia trả lời thân thiện).  
• \`/botcute\` — Bật kênh Meyia Cute (nũng nịu, nhiều emoji).  
• \`/giveaway time:... winners:... prize:...\` — Tạo giveaway (phần thưởng lớn, đếm ngược, chọn winner).  
• \`/avatar\` — Xem avatar người dùng.  
• \`/info\` — Xem thông tin & hướng dẫn.  
• \`/status\` — Trạng thái bot.  
• \`!mute\` / \`!unmute\` — Tắt/bật phản hồi ở kênh (nhắn trong kênh muốn mute).  
• \`!shutdown\` / \`!restart\` — Lệnh admin (chỉ owner).

---

**🧠 Cơ chế phản hồi & bối cảnh**
• Bot lưu **15 tin nhắn gần nhất** kể từ khi bot được bật trong kênh.  
• **Khi có người nhắc tên bot** (ví dụ: \"Meyia ơi\") — bot **luôn** đọc **5 tin nhắn gần nhất** để bắt bối cảnh và phản hồi. (Không phân biệt dấu/viết hoa.)  
• Nếu **10 tin nhắn** trôi qua mà không ai nhắc, bot sẽ **kiểm tra** và có **30% khả năng** tự tham gia (đọc 5 tin gần nhất và reply). Bot chỉ kiểm tra tối đa **3 lần** theo chu kỳ này, sau đó dừng chờ người nhắc tên.  
• Cả **chatbot** & **botcute** đều áp dụng cơ chế trên (chỉ khác giọng điệu).

---

**💡 Mẹo sử dụng**
• Muốn bot kể chuyện: gõ \"Meyia kể chuyện cổ tích đi\" trong kênh đã bật.  
• Nếu bot phản hồi ngắn — bạn có thể thêm: \"hãy kể dài hơn\" để bot mở rộng câu trả lời.

`)
      .setFooter({ text: "Meyia — người bạn nhỏ đáng yêu của bạn 💕" });
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
});

// -------------------------
// 🧠 XỬ LÝ TIN NHẮN (CHATBOT + BOTCUTE)
// -------------------------
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  // Quản lý lệnh text
  const args = message.content.trim().split(/\s+/);
  const cmd = args.shift()?.toLowerCase();

  // lệnh quản lý nội bộ
  if (cmd === "!shutdown" && message.author.id === OWNER_ID) {
    await message.reply("💤 Meyia tắt đây... hẹn gặp lại sau nha~");
    process.exit(0);
  }
  if (cmd === "!restart" && message.author.id === OWNER_ID) {
    await message.reply("🔄 Meyia đang khởi động lại...");
    process.exit(0);
  }
  if (cmd === "!mute") {
    muteChannel(message.channel.id);
    return message.reply("🔇 Meyia đã tạm ngưng chat trong kênh này!");
  }
  if (cmd === "!unmute") {
    unmuteChannel(message.channel.id);
    return message.reply("🔊 Đã gỡ mute cho kênh này!");
  }
  if (cmd === "!status") {
    return message.reply(getStatusString());
  }

  // Nếu kênh đang mute thì không xử lý chat AI
  if (mutedChannels.has(message.channel.id)) return;

  // Push message vào history channel (lưu cả author để lọc bot)
  pushChannelHistory(message.channel.id, {
    id: message.id,
    authorId: message.author.id,
    content: message.content,
    timestamp: Date.now()
  });

  // Xác định xem message có phải trong activeChatChannel hay activeCuteChannel
  const isChatChannel = activeChatChannel && message.channel.id === activeChatChannel;
  const isCuteChannel = activeCuteChannel && message.channel.id === activeCuteChannel;

  // Nếu message không nằm trong 2 kênh active thì không làm gì
  if (!isChatChannel && !isCuteChannel) return;

  // Anti-spam: tránh bot trả lời quá dày trong cùng kênh
  const lastResp = lastResponseTime.get(message.channel.id) || 0;
  if (Date.now() - lastResp < ANTI_SPAM_MS) {
    // nhưng vẫn cần update counters for passive checks
    const prev = messagesSinceMention.get(message.channel.id) || 0;
    messagesSinceMention.set(message.channel.id, prev + 1);
    return;
  }

  // KIỂM TRA: người dùng có nhắc tên bot trong message không?
  const mentioned = containsBotName(message.content);
  if (mentioned) {
    // Reset counters cho kênh này
    messagesSinceMention.set(message.channel.id, 0);
    passiveChecksDone.set(message.channel.id, 0);
    lastPassiveCheckIndex.set(message.channel.id, 0);

    // Lấy 5 tin nhắn gần nhất (bao gồm cả message hiện tại) để tạo context
    const recent = getRecentMessages(message.channel.id, READ_ON_MENTION);

    // Chuẩn bị messages cho OpenAI
    const messagesForOpenAI = buildOpenAIMessages(recent, isCuteChannel ? "cute" : "normal");

    // Gọi OpenAI và reply
    try {
      await message.channel.sendTyping();
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // chọn model tốt hơn: gpt-4o (nếu muốn tiết kiệm, đổi về gpt-4o-mini)
        messages: messagesForOpenAI,
        temperature: isCuteChannel ? 0.95 : 0.85,
        max_tokens: isCuteChannel ? 180 : 300
      });
      const replyText = response.choices?.[0]?.message?.content?.trim() || "Huhu... em chưa trả lời được, thử lại nha~";
      await message.reply(replyText);
      lastResponseTime.set(message.channel.id, Date.now());

      // Lưu assistant reply vào history
      pushChannelHistory(message.channel.id, {
        id: `assistant-${Date.now()}`,
        authorId: client.user.id,
        content: replyText,
        timestamp: Date.now()
      });
    } catch (err) {
      console.error("Lỗi khi gọi OpenAI:", err);
      await message.reply("🥺 Em bị lag xíu, nói lại cho Meyia nha~");
      lastResponseTime.set(message.channel.id, Date.now());
    }
    return;
  }

  // Nếu không có mention -> xử lý passive checks
  // tăng counter
  const prevCount = messagesSinceMention.get(message.channel.id) || 0;
  const newCount = prevCount + 1;
  messagesSinceMention.set(message.channel.id, newCount);

  // Nếu đạt đúng bội số PASSIVE_INTERVAL => check
  const lastIndex = lastPassiveCheckIndex.get(message.channel.id) || 0;
  const currentIndex = Math.floor(newCount / PASSIVE_INTERVAL);
  if (currentIndex > lastIndex) {
    // chỉ check nếu chưa vượt số lần cho phép
    const tries = passiveChecksDone.get(message.channel.id) || 0;
    if (tries >= PASSIVE_MAX_TRIES) {
      // đã thử tối đa, dừng cho tới khi có mention
      lastPassiveCheckIndex.set(message.channel.id, currentIndex);
      return;
    }
    // tăng số lần đã thử (dù có đọc hay không)
    passiveChecksDone.set(message.channel.id, tries + 1);
    lastPassiveCheckIndex.set(message.channel.id, currentIndex);

    // roll 30% chance
    const roll = Math.random();
    if (roll <= 0.3) {
      // passive read: bot đọc 5 tin gần nhất và reply (giống khi mention nhưng chỉ khi random success)
      const recent = getRecentMessages(message.channel.id, READ_ON_MENTION);
      const messagesForOpenAI = buildOpenAIMessages(recent, isCuteChannel ? "cute" : "normal", true); // passive flag
      try {
        await message.channel.sendTyping();
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: messagesForOpenAI,
          temperature: isCuteChannel ? 0.9 : 0.8,
          max_tokens: isCuteChannel ? 120 : 200
        });
        const replyText = response.choices?.[0]?.message?.content?.trim() || "Em góp ý chút nè~";
        await message.channel.send(replyText);
        lastResponseTime.set(message.channel.id, Date.now());
        // lưu vào history
        pushChannelHistory(message.channel.id, {
          id: `assistant-${Date.now()}`,
          authorId: client.user.id,
          content: replyText,
          timestamp: Date.now()
        });
      } catch (err) {
        console.error("Lỗi OpenAI passive read:", err);
      }
    } else {
      // didn't trigger; do nothing (but we counted one passive try)
    }
  }
});

// -------------------------
// HÀM XÂY DỰNG PROMPT CHO OPENAI
// -------------------------
function buildOpenAIMessages(recentMessages, mode = "normal", passive = false) {
  // recentMessages: array [{authorId, content, timestamp}, ...] (chronological)
  // mode: "normal" | "cute"
  // passive: boolean (nếu true, bot tính là tự tham gia, nên trả lời ngắn gọn)
  const systemBaseNormal = `
Bạn là Meyia, một cô gái 18 tuổi thân thiện, tinh nghịch và dễ gần.
Trả lời tự nhiên như một người bạn thật, sử dụng emoji phù hợp.
Khi được gọi hãy trả lời đầy đủ, 2-6 câu, có thể hỏi lại để giữ cuộc trò chuyện.
`;
  const systemBaseCute = `
Bạn là Meyia Cute — cực kỳ đáng yêu, nói chuyện như bé con, hay nhõng nhẽo và dùng emoji nhiều.
Trả lời ngắn gọn, ngọt ngào, 1-3 câu, dùng emoji (🥺💖✨).
`;

  const system = mode === "cute" ? systemBaseCute : systemBaseNormal;

  // Build messages array starting with system
  const msgs = [{ role: "system", content: system }];

  // Convert recentMessages into user/assistant sequence (we only have raw messages; mark them as user)
  // Keep chronological order
  for (const m of recentMessages) {
    // If message from bot user id -> assistant; else user
    if (m.authorId === client.user.id) {
      msgs.push({ role: "assistant", content: m.content });
    } else {
      msgs.push({ role: "user", content: m.content });
    }
  }

  // If passive flag, give instruction to be brief / non-intrusive
  if (passive) {
    msgs.push({ role: "system", content: "Lưu ý: Đây là phản hồi tự phát (không ai gọi tên bot). Hãy trả lời ngắn gọn, lịch sự, không gây phiền." });
  }

  return msgs;
}

// -------------------------
// LOGIN
// -------------------------
client.login(process.env.TOKEN).catch(err => console.error("❌ Lỗi đăng nhập:", err.message));
