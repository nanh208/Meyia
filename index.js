// index.js — Meyia all-in-one (v1.3.0) — chỉnh sửa để hỗ trợ sk-proj-...
// Tác giả: bạn + hỗ trợ từ ChatGPT
// Yêu cầu: node 18+, discord.js v14, openai package, dotenv, ms, discord-giveaways

require("dotenv").config(); // phải load dotenv ngay đầu
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

// --- OpenAI init: hỗ trợ sk-... và sk-proj-...
const rawKey = process.env.OPENAI_API_KEY;
const openaiOptions = {};

if (!rawKey) {
  console.error("❌ OPENAI_API_KEY chưa thiết lập. Thêm vào .env: OPENAI_API_KEY=sk-...");
  // không throw để bot vẫn có thể khởi động (nhưng API call sẽ fail). Tuy nhiên khuyến nghị dừng.
} else {
  // nếu key là sk-proj-... thì cần project id (proj_...)
  if (rawKey.startsWith("sk-proj-")) {
    if (!process.env.OPENAI_PROJECT) {
      console.error("❌ Bạn đang dùng key bắt đầu bằng sk-proj- nhưng chưa thiết lập OPENAI_PROJECT trong .env");
      console.error("Ví dụ: OPENAI_PROJECT=proj_xxxxxxxx");
      // vẫn set apiKey để lỗi rõ hơn khi gọi; thông báo cho dev
    } else {
      openaiOptions.project = process.env.OPENAI_PROJECT;
    }
  }
  // optional organization
  if (process.env.OPENAI_ORG) openaiOptions.organization = process.env.OPENAI_ORG;

  openaiOptions.apiKey = rawKey;
}

// tạo client OpenAI
const openai = new OpenAI(openaiOptions);

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
  const norm = normalizeText(raw);
  return /\bmeyia\b/.test(norm);
}

// lưu lịch sử tin nhắn cho kênh (chỉ giữ MAX_HISTORY)
function pushChannelHistory(channelId, msgObj) {
  const arr = channelHistories.get(channelId) || [];
  arr.push(msgObj);
  while (arr.length > MAX_HISTORY) arr.shift();
  channelHistories.set(channelId, arr);
}

// Lấy N tin nhắn trước đó
function getRecentMessages(channelId, n = 5) {
  const arr = channelHistories.get(channelId) || [];
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

  // Thông tin debug nhỏ về OpenAI config (không in full key)
  if (rawKey) {
    console.log("🔑 OPENAI_API_KEY tải từ env — prefix:", rawKey.slice(0, 10));
    if (openaiOptions.project) console.log("📁 OPENAI_PROJECT =", openaiOptions.project);
    if (openaiOptions.organization) console.log("🏢 OPENAI_ORG =", openaiOptions.organization);
  } else {
    console.warn("⚠️ OPENAI_API_KEY không được cấu hình — mọi yêu cầu đến OpenAI sẽ fail.");
  }

  // đăng ký slash commands
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

> 💡 Gọi Meyia bằng cách nhắc tên (ví dụ: "Meyia ơi", "ê Meyia") — không phân biệt dấu/viết hoa.
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

  // GIVEAWAY
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
    try {
      await msg.react("<a:1261960933270618192:1433286685189341204>");
    } catch (err) {
      console.warn("Không thể react bằng custom emoji (kiểm tra quyền hoặc emoji tồn tại).", err);
    }

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

    await updateEmbed();

    const countdown = setInterval(async () => {
      const remaining = endTime - Date.now();
      if (remaining <= 0) {
        clearInterval(countdown);
        let fetchedMsg;
        try { fetchedMsg = await interaction.channel.messages.fetch(msg.id); } catch (err) {
          console.error("Không fetch được message giveaway:", err);
          await interaction.followUp({ content: "❌ Đã xảy ra lỗi khi kết thúc giveaway (không fetch được tin nhắn).", ephemeral: true });
          return;
        }

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
          .setTitle("<a:1255341894687260775:1433317867293642858> 💫 ＧＩＶＥＡＷＡＹ ĐÃ KẾT THÚC 💫 <a:1255341894687260775:1433317867293642858>")
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

  // CHATBOT
  if (interaction.commandName === "chatbot") {
    const channel = interaction.options.getChannel("kenh");
    setActiveChat(channel.id);
    return interaction.reply(`✅ Meyia sẽ trò chuyện trong kênh: ${channel}`);
  }

  // BOTCUTE
  if (interaction.commandName === "botcute") {
    const channel = interaction.options.getChannel("kenh");
    setActiveCute(channel.id);
    return interaction.reply(`💖 Meyia Cute sẽ trò chuyện trong kênh: ${channel}`);
  }

  // INFO
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

[...giữ nguyên nội dung help như trước...]
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

  const args = message.content.trim().split(/\s+/);
  const cmd = args.shift()?.toLowerCase();

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

  if (mutedChannels.has(message.channel.id)) return;

  pushChannelHistory(message.channel.id, {
    id: message.id,
    authorId: message.author.id,
    content: message.content,
    timestamp: Date.now()
  });

  const isChatChannel = activeChatChannel && message.channel.id === activeChatChannel;
  const isCuteChannel = activeCuteChannel && message.channel.id === activeCuteChannel;

  if (!isChatChannel && !isCuteChannel) return;

  const lastResp = lastResponseTime.get(message.channel.id) || 0;
  if (Date.now() - lastResp < ANTI_SPAM_MS) {
    const prev = messagesSinceMention.get(message.channel.id) || 0;
    messagesSinceMention.set(message.channel.id, prev + 1);
    return;
  }

  const mentioned = containsBotName(message.content);
  if (mentioned) {
    messagesSinceMention.set(message.channel.id, 0);
    passiveChecksDone.set(message.channel.id, 0);
    lastPassiveCheckIndex.set(message.channel.id, 0);

    const recent = getRecentMessages(message.channel.id, READ_ON_MENTION);
    const messagesForOpenAI = buildOpenAIMessages(recent, isCuteChannel ? "cute" : "normal");

    try {
      await message.channel.sendTyping();

      // chọn model: ưu tiên gpt-4o nếu có; nếu lỗi unauthorized -> fallback gpt-4o-mini
      const modelToUse = process.env.PREFERRED_MODEL || "gpt-4o";

      const response = await openai.chat.completions.create({
        model: modelToUse,
        messages: messagesForOpenAI,
        temperature: isCuteChannel ? 0.95 : 0.85,
        max_tokens: isCuteChannel ? 180 : 300
      });

      const replyText = response.choices?.[0]?.message?.content?.trim() || "Huhu... em chưa trả lời được, thử lại nha~";
      await message.reply(replyText);
      lastResponseTime.set(message.channel.id, Date.now());

      pushChannelHistory(message.channel.id, {
        id: `assistant-${Date.now()}`,
        authorId: client.user.id,
        content: replyText,
        timestamp: Date.now()
      });
    } catch (err) {
      // hiển thị lỗi chi tiết (nếu là response data thì in data)
      console.error("Lỗi khi gọi OpenAI:", err.response?.data || err.message || err);
      // nếu lỗi do model/unautorized, thử fallback
      const errMsg = (err.response?.status) ? `${err.response.status} ${err.response.statusText}` : err.message;
      if (errMsg && /401|Unauthorized|permission/i.test(String(errMsg))) {
        // thông báo rõ ràng cho admin
        await message.reply("🥺 Lỗi xác thực OpenAI (401). Kiểm tra OPENAI_API_KEY/OPENAI_PROJECT trong .env.");
      } else if (/model|not found|invalid/i.test(String(errMsg))) {
        // thử fallback model
        try {
          console.log("⚠️ Thử fallback sang gpt-4o-mini...");
          const fallback = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: buildOpenAIMessages(getRecentMessages(message.channel.id, READ_ON_MENTION), isCuteChannel ? "cute" : "normal"),
            temperature: isCuteChannel ? 0.9 : 0.8,
            max_tokens: isCuteChannel ? 120 : 200
          });
          const replyText = fallback.choices?.[0]?.message?.content?.trim() || "Em góp ý chút nè~";
          await message.reply(replyText);
          lastResponseTime.set(message.channel.id, Date.now());
          pushChannelHistory(message.channel.id, {
            id: `assistant-${Date.now()}`,
            authorId: client.user.id,
            content: replyText,
            timestamp: Date.now()
          });
        } catch (err2) {
          console.error("Fallback cũng lỗi:", err2.response?.data || err2.message || err2);
          await message.reply("🥺 Em đang gặp lỗi kết nối với OpenAI. Người quản trị kiểm tra lại key và project nha.");
          lastResponseTime.set(message.channel.id, Date.now());
        }
      } else {
        await message.reply("🥺 Em bị lag xíu, nói lại cho Meyia nha~");
        lastResponseTime.set(message.channel.id, Date.now());
      }
    }
    return;
  }

  // passive checks
  const prevCount = messagesSinceMention.get(message.channel.id) || 0;
  const newCount = prevCount + 1;
  messagesSinceMention.set(message.channel.id, newCount);

  const lastIndex = lastPassiveCheckIndex.get(message.channel.id) || 0;
  const currentIndex = Math.floor(newCount / PASSIVE_INTERVAL);
  if (currentIndex > lastIndex) {
    const tries = passiveChecksDone.get(message.channel.id) || 0;
    if (tries >= PASSIVE_MAX_TRIES) {
      lastPassiveCheckIndex.set(message.channel.id, currentIndex);
      return;
    }
    passiveChecksDone.set(message.channel.id, tries + 1);
    lastPassiveCheckIndex.set(message.channel.id, currentIndex);

    const roll = Math.random();
    if (roll <= 0.3) {
      const recent = getRecentMessages(message.channel.id, READ_ON_MENTION);
      const messagesForOpenAI = buildOpenAIMessages(recent, isCuteChannel ? "cute" : "normal", true);
      try {
        await message.channel.sendTyping();
        const response = await openai.chat.completions.create({
          model: process.env.PREFERRED_MODEL || "gpt-4o",
          messages: messagesForOpenAI,
          temperature: isCuteChannel ? 0.9 : 0.8,
          max_tokens: isCuteChannel ? 120 : 200
        });
        const replyText = response.choices?.[0]?.message?.content?.trim() || "Em góp ý chút nè~";
        await message.channel.send(replyText);
        lastResponseTime.set(message.channel.id, Date.now());
        pushChannelHistory(message.channel.id, {
          id: `assistant-${Date.now()}`,
          authorId: client.user.id,
          content: replyText,
          timestamp: Date.now()
        });
      } catch (err) {
        console.error("Lỗi OpenAI passive read:", err.response?.data || err.message || err);
      }
    }
  }
});

// -------------------------
// HÀM XÂY DỰNG PROMPT CHO OPENAI
// -------------------------
function buildOpenAIMessages(recentMessages, mode = "normal", passive = false) {
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

  const msgs = [{ role: "system", content: system }];

  for (const m of recentMessages) {
    if (m.authorId === client.user.id) {
      msgs.push({ role: "assistant", content: m.content });
    } else {
      msgs.push({ role: "user", content: m.content });
    }
  }

  if (passive) {
    msgs.push({ role: "system", content: "Lưu ý: Đây là phản hồi tự phát (không ai gọi tên bot). Hãy trả lời ngắn gọn, lịch sự, không gây phiền." });
  }

  return msgs;
}

// -------------------------
// LOGIN
// -------------------------
client.login(process.env.TOKEN).catch(err => console.error("❌ Lỗi đăng nhập:", err.message));
