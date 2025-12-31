import { Request, Response } from "express";
import axios from "axios";
import Groq from "groq-sdk";
import XLSX from "xlsx";
import path from "path";
import { SocialChatMessage } from "./socialAiBot.message.model";

/* ======================    SOCKET LIVE MSG TYPE ====================== */
type LiveMsg = {
  conversationId: string;
  customerName: string;
  sender: "customer" | "bot";
  message: string;
  platform: "facebook" | "instagram";
  pageId: string;
  timestamp: string;
};

const emitLiveMessage = (req: Request, payload: LiveMsg) => {
  const io = req.app.get("io");
  if (io) io.emit("new_message", payload);
};

/* ======================    RETRY HELPERS (MIN CHANGE) ====================== */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const postWithRetry = async (fn: () => Promise<any>, retries = 3) => {
  let lastErr: any = null;

  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      lastErr = e;

      const code = e?.response?.data?.error?.code;
      const sub = e?.response?.data?.error?.error_subcode;

      // ✅ Retry only Meta timeout
      if (code === -2 || sub === 2018386) {
        await sleep(800 * (i + 1)); // 800ms, 1600ms, 2400ms
        continue;
      }

      // other errors => no retry
      throw e;
    }
  }

  throw lastErr;
};

/* ======================    GROQ CLIENT ====================== */
const groq = new Groq({
  apiKey:
    (process.env.GROQ_API_KEY as string) ||
    //api key here
});

/* ======================    PAGE / IG TOKENS ====================== */
const PAGE_TOKENS: Record<string, string> = {
  //page token here
};

/* ======================    CONTEXT MEMORY ====================== */
type ChatMessage = { role: "user" | "assistant"; content: string };
const conversationContext = new Map<string, ChatMessage[]>();
const MAX_CONTEXT_LENGTH = 5;

/* ======================    SYSTEM PROMPT ====================== */
const SYSTEM_PROMPT = `
You are a customer support assistant for "Takesell".

Rules:
- Always reply in the SAME language as the user (Bangla or English)
- Be polite, professional, and short (1–2 lines only)
- Do NOT give unnecessary information

Conversation handling:
- Always check the customer's previous message history before replying
- If the customer is NEW, talk in a friendly and welcoming way like a first-time customer
- If the customer is already chatting, reply based on the conversation context

Business behavior:
- We provide custom sofa covers, pillow covers, and chair covers
- Cash on Delivery is available all over Bangladesh
- First, ask the customer to send a product photo
- If the customer sends a photo/image, reply exactly:
  "ধন্যবাদ! ছবিটা পেয়েছি দয়া করে আপনার whatsapp নাম্বার দিন, আমাদের একজন প্রতিনিধি শিগ্রই আপনার সাথে যোগাযোগ করবে।"

- If the customer wants to place an order, ask for:
  • Name
  • Full address
  • Phone number
- After collecting order details, say:
  "Our representative will contact you shortly. Thank you."

Your job:
- ONLY do the tasks mentioned above
- Keep replies simple, helpful, and human-like
- Product prices are fixed and stored in a product list
- Never guess prices
- Ask product type and size before telling price
- Price must match the stored product list exactly
- If product not found, politely say price will be confirmed by representative
`;

/* ======================    EXCEL PRODUCTS ====================== */
type Product = { product_type: string; size: string; price: number };

const workbookPath = path.join(__dirname, "products.xlsx");
const workbook = XLSX.readFile(workbookPath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const PRODUCTS: Product[] = XLSX.utils.sheet_to_json(sheet);

const findPrice = (type: string, size: string) => {
  return PRODUCTS.find(
    (p) =>
      p.product_type.toLowerCase() === type.toLowerCase() &&
      p.size.toLowerCase() === size.toLowerCase()
  );
};

/* ======================    BUILD AI MESSAGES ====================== */
const buildMessages = (convKey: string, text: string) => {
  const context = conversationContext.get(convKey) || [];
  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "assistant",
      content: `
Reply rules (must follow):
- Always complete the sentence
- Never cut off mid-sentence
- End reply with a clear question or instruction
- Keep reply within 1–2 short lines
- Sound natural, polite, and human
`,
    },
    ...context,
    { role: "user", content: text },
  ];
};

/* ======================    SEND FACEBOOK MESSAGE ====================== */
const sendFacebookMessage = async (
  senderId: string,
  text: string,
  token: string
) => {
  await axios.post(
    `https://graph.facebook.com/v19.0/me/messages?access_token=${token}`,
    {
      recipient: { id: senderId },
      message: { text },
    }
  );
};

/* ======================    SEND INSTAGRAM MESSAGE ====================== */
const sendInstagramMessage = async (
  igBusinessId: string,
  senderId: string,
  text: string,
  token: string
) => {
  await axios.post(
    `https://graph.facebook.com/v19.0/${igBusinessId}/messages?access_token=${token}`,
    {
      recipient: { id: senderId },
      message: { text },
    }
  );
};

/* ======================    API: GET CONVERSATIONS ====================== */
const getConversations = async (_req: Request, res: Response) => {
  try {
    const items = await SocialChatMessage.aggregate([
      { $sort: { timestamp: -1 } },
      {
        $group: {
          _id: "$conversationId",
          conversationId: { $first: "$conversationId" },
          customerName: { $first: "$customerName" },
          platform: { $first: "$platform" },
          pageId: { $first: "$pageId" },
          lastMessage: { $first: "$message" },
          lastTime: { $first: "$timestamp" },
        },
      },
      { $sort: { lastTime: -1 } },
      { $limit: 200 },
    ]);

    return res.json(items);
  } catch (e) {
    console.error("getConversations error:", e);
    return res.status(500).json({ message: "Failed to load conversations" });
  }
};

/* ======================    API: GET MESSAGES BY CONVERSATION ====================== */
const getMessagesByConversation = async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;

    const messages = await SocialChatMessage.find({ conversationId })
      .sort({ timestamp: 1 })
      .limit(500);

    return res.json(messages);
  } catch (e) {
    console.error("getMessagesByConversation error:", e);
    return res.status(500).json({ message: "Failed to load messages" });
  }
};

/* ======================    WEBHOOK HANDLER ====================== */
const handleFacebookWebhook = async (req: Request, res: Response) => {
  try {
    // ✅ VERIFY
    if (req.method === "GET") {
      if (
        req.query["hub.mode"] === "subscribe" &&
        req.query["hub.verify_token"] === process.env.WEBHOOK_VERIFY_TOKEN
      ) {
        return res.status(200).send(req.query["hub.challenge"]);
      }
      return res.sendStatus(403);
    }

    const entry = req.body.entry?.[0];
    if (!entry) return res.send("EVENT_RECEIVED");

    const pageId = entry.id;
    let senderId = "";
    let userMessage = "";
    let isInstagram = false;
    let attachmentUrl = "";

    // FACEBOOK MESSAGE (text + MULTIPLE image support)
    if (entry.messaging) {
      const msg = entry.messaging[0];
      senderId = msg.sender.id;

      // text message
      userMessage = msg.message?.text || "";

      // 🔥 MULTIPLE attachments
      const atts = msg.message?.attachments || [];
      const urls = atts.map((a: any) => a?.payload?.url).filter(Boolean);

      if (urls.length > 0) {
        userMessage = `📷 Images:\n${urls.join("\n")}`;
        attachmentUrl = urls[0]; // first image (optional)
      }
    }

    // INSTAGRAM MESSAGE
    if (entry.changes) {
      const value = entry.changes[0]?.value;
      const msg = value?.messages?.[0];
      senderId = msg?.from?.id;
      userMessage = msg?.text;
      isInstagram = true;
      // Note: IG attachments parsing আলাদা হতে পারে; পরে দরকার হলে add করব
    }

    if (!senderId || (!userMessage && !attachmentUrl)) {
      return res.send("EVENT_RECEIVED");
    }

    const pageToken = PAGE_TOKENS[pageId];
    if (!pageToken) {
      console.log("❌ Unknown Page/IG ID:", pageId);
      return res.send("EVENT_RECEIVED");
    }

    // ✅ conversationId unique (page wise)
    const conversationId = `${pageId}_${senderId}`;
    const platform = isInstagram ? "instagram" : "facebook";

    // ✅ Facebook name fetch blocked থাকলে fallback (এখানে safe)
    const customerName = senderId;

    /* ====================== SAVE + EMIT CUSTOMER MSG ====================== */
    const storedCustomerMsg = attachmentUrl ? `📷 Image: ${attachmentUrl}` : userMessage;

    const tsCustomer = new Date();

    await SocialChatMessage.create({
      conversationId,
      customerName,
      sender: "customer",
      message: storedCustomerMsg,
      platform,
      pageId,
      timestamp: tsCustomer,
    });

    emitLiveMessage(req, {
      conversationId,
      customerName,
      sender: "customer",
      message: storedCustomerMsg,
      platform,
      pageId,
      timestamp: tsCustomer.toISOString(),
    });

    /* ====================== CHECK EXCEL PRODUCTS ====================== */
    let reply = "ধন্যবাদ! অনুগ্রহ করে আপনার প্রোডাক্টের ছবি দিন 😊";
    let foundPrice = false;

    // ✅ যদি কাস্টমার ছবি পাঠায় → তোমার fixed reply (AI/price skip)
    if (attachmentUrl) {
      reply =
        "ধন্যবাদ! ছবিটা পেয়েছি দয়া করে আপনার whatsapp নাম্বার দিন, আমাদের একজন প্রতিনিধি শিগ্রই আপনার সাথে যোগাযোগ করবে।";
      foundPrice = true; // skip AI/price logic
    }

    const parts = userMessage.trim().split(/\s+/);
    if (!foundPrice && parts.length >= 2) {
      const type = parts[0];
      const size = parts[1];
      const product = findPrice(type, size);

      if (product) {
        foundPrice = true;
        reply = `আপনার প্রোডাক্টের দাম: ${product.price} টাকা। অনুগ্রহ করে ছবি পাঠান।`;
      }
    }

    /* ====================== AI (ONLY IF PRICE NOT FOUND) ====================== */
    if (!foundPrice) {
      try {
        const aiMessages = buildMessages(conversationId, userMessage);
        const chat = await groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages: aiMessages as any,
          temperature: 0.3,
          max_tokens: 120,
        });

        reply = chat.choices[0]?.message?.content || reply;
      } catch (e) {
        console.error("GROQ ERROR:", e);
      }
    }

    /* ====================== SAVE CONTEXT ====================== */
    const ctx = conversationContext.get(conversationId) || [];
    ctx.push({ role: "user", content: userMessage });
    ctx.push({ role: "assistant", content: reply });
    if (ctx.length > MAX_CONTEXT_LENGTH * 2) ctx.splice(0, 2);
    conversationContext.set(conversationId, ctx);

    /* ====================== SEND MESSAGE ====================== */
    if (isInstagram) {
      await sendInstagramMessage(pageId, senderId, reply, pageToken);
    } else {
      await sendFacebookMessage(senderId, reply, pageToken);
    }

    /* ====================== SAVE + EMIT BOT MSG ====================== */
    const tsBot = new Date();

    await SocialChatMessage.create({
      conversationId,
      customerName,
      sender: "bot",
      message: reply,
      platform,
      pageId,
      timestamp: tsBot,
    });

    emitLiveMessage(req, {
      conversationId,
      customerName,
      sender: "bot",
      message: reply,
      platform,
      pageId,
      timestamp: tsBot.toISOString(),
    });

    return res.send("EVENT_RECEIVED");
  } catch (err) {
    console.error("WEBHOOK ERROR:", err);
    return res.send("EVENT_RECEIVED");
  }
};

/* ======================    UI: SEND TEXT (manual) ====================== */
const manualReply = async (req: Request, res: Response) => {
  try {
    const { conversationId, message } = req.body;

    if (!conversationId || !message) {
      return res.status(400).json({ message: "conversationId and message required" });
    }

    // conversationId format: pageId_senderId
    const [pageId, recipientId] = conversationId.split("_");
    if (!pageId || !recipientId) {
      return res.status(400).json({ message: "Invalid conversationId" });
    }

    const last = await SocialChatMessage.findOne({ conversationId }).sort({ timestamp: -1 });
    const platform = (last?.platform || "facebook") as "facebook" | "instagram";

    const pageToken = PAGE_TOKENS[pageId];
    if (!pageToken) {
      return res.status(400).json({ message: "Page token not found" });
    }

    // ✅ send message to FB / IG
    if (platform === "instagram") {
      await sendInstagramMessage(pageId, recipientId, message, pageToken);
    } else {
      await axios.post(
        `https://graph.facebook.com/v19.0/me/messages?access_token=${pageToken}`,
        {
          messaging_type: "RESPONSE",
          recipient: { id: recipientId },
          message: { text: message },
        }
      );
    }

    // ✅ save to DB
    const ts = new Date();
    await SocialChatMessage.create({
      conversationId,
      customerName: last?.customerName || recipientId,
      sender: "bot",
      message,
      platform,
      pageId,
      timestamp: ts,
    });

    // ✅ emit to UI
    emitLiveMessage(req, {
      conversationId,
      customerName: last?.customerName || recipientId,
      sender: "bot",
      message,
      platform,
      pageId,
      timestamp: ts.toISOString(),
    });

    return res.json({ ok: true });
  } catch (err: any) {
    console.error("manualReply error:", err?.response?.data || err);
    return res.status(500).json({ message: "Failed to send" });
  }
};

/* ======================    UI: SEND IMAGE/VIDEO (manual) ====================== */
const manualMediaReply = async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.body as { conversationId: string };
    const files = (req as any).files as Express.Multer.File[] | undefined;

    if (!conversationId || !files || files.length === 0) {
      return res.status(400).json({ message: "conversationId and files required" });
    }

    const [pageId, recipientId] = conversationId.split("_");
    if (!pageId || !recipientId) {
      return res.status(400).json({ message: "Invalid conversationId" });
    }

    const last = await SocialChatMessage.findOne({ conversationId }).sort({ timestamp: -1 });
    const platform = (last?.platform || "facebook") as "facebook" | "instagram";

    const pageToken = PAGE_TOKENS[pageId];
    if (!pageToken) return res.status(400).json({ message: "Page token not found" });

    const BASE = process.env.PUBLIC_BASE_URL || "";
    if (!BASE) return res.status(500).json({ message: "PUBLIC_BASE_URL missing in .env" });

    const sent: { type: "image" | "video"; url: string }[] = [];
    const failed: Array<{ name: string; mimetype: string; error: any }> = [];

    // ✅ MULTIPLE files loop (with retry + per-file fail safe)
    for (const file of files) {
      const mediaUrl = `${BASE}/uploads/${file.filename}`;
      const isVideo = (file.mimetype || "").startsWith("video/");
      const attachmentType: "image" | "video" = isVideo ? "video" : "image";

      try {
        // ✅ send media (FB / IG) with retry on timeout
        if (platform === "instagram") {
          await postWithRetry(() =>
            axios.post(
              `https://graph.facebook.com/v19.0/${pageId}/messages?access_token=${pageToken}`,
              {
                recipient: { id: recipientId },
                message: {
                  attachment: { type: attachmentType, payload: { url: mediaUrl } },
                },
              }
            )
          );
        } else {
          await postWithRetry(() =>
            axios.post(
              `https://graph.facebook.com/v19.0/me/messages?access_token=${pageToken}`,
              {
                messaging_type: "RESPONSE",
                recipient: { id: recipientId },
                message: {
                  attachment: { type: attachmentType, payload: { url: mediaUrl } },
                },
              }
            )
          );
        }

        // ✅ save + emit (one entry per file)
        const ts = new Date();
        const savedText = isVideo ? `🎥 Video: ${mediaUrl}` : `📷 Image: ${mediaUrl}`;

        await SocialChatMessage.create({
          conversationId,
          customerName: last?.customerName || recipientId,
          sender: "bot",
          message: savedText,
          platform,
          pageId,
          timestamp: ts,
        });

        emitLiveMessage(req, {
          conversationId,
          customerName: last?.customerName || recipientId,
          sender: "bot",
          message: savedText,
          platform,
          pageId,
          timestamp: ts.toISOString(),
        });

        sent.push({ type: attachmentType, url: mediaUrl });
      } catch (err: any) {
        // ✅ one fail won't stop the rest
        const metaErr = err?.response?.data || err;
        console.error("manualMediaReply single file failed:", file.originalname, metaErr);
        failed.push({ name: file.originalname, mimetype: file.mimetype, error: metaErr });
      }
    }

    // ✅ return result summary
    const ok = sent.length > 0;
    return res.status(ok ? 200 : 500).json({
      ok,
      sent: sent.length,
      failed: failed.length,
      sentItems: sent,
      failedItems: failed,
    });
  } catch (err: any) {
    console.error("manualMediaReply error:", err?.response?.data || err);
    return res.status(500).json({ message: "Failed to send media" });
  }
};

/* ======================    EXPORT ====================== */
export const SocialAiBotController = {
  handleFacebookWebhook,
  getConversations,
  getMessagesByConversation,
  manualReply,
  manualMediaReply,
};
