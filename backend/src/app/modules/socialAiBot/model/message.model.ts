import { Schema, model } from "mongoose";

const MessageSchema = new Schema(
  {
    platform: {
      type: String,
      enum: ["facebook", "instagram"],
      required: true,
    },
    pageId: {
      type: String,
      required: true,
    },
    senderId: {
      type: String,
      required: true,
    },
    senderType: {
      type: String,
      enum: ["customer", "bot"],
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export const MessageModel = model("Message", MessageSchema);
