import { Schema, model } from "mongoose";

const MessageSchema = new Schema(
  {
    conversationId: { type: String, required: true, index: true }, // PSID
    customerName: { type: String, default: "" },
    sender: { type: String, enum: ["customer", "bot"], required: true },
    message: { type: String, required: true },
    platform: { type: String, enum: ["facebook", "instagram"], required: true },
    pageId: { type: String, required: true },
    timestamp: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

export const SocialChatMessage = model("SocialChatMessage", MessageSchema);
