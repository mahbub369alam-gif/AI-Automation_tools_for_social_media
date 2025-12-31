import express from "express";
import multer from "multer";
import path from "path";
import { SocialAiBotController } from "./socialAiBot.controller";

const router = express.Router();

const upload = multer({
  dest: path.join(process.cwd(), "uploads"),
  limits: { fileSize: 6 * 1024 * 1024 }, // ✅ 10MB max
});

router
  .route("/facebook/webhook")
  .get(SocialAiBotController.handleFacebookWebhook)
  .post(SocialAiBotController.handleFacebookWebhook);

router.get("/conversations", SocialAiBotController.getConversations);
router.get("/messages/:conversationId", SocialAiBotController.getMessagesByConversation);

router.post("/manual-reply", SocialAiBotController.manualReply);

router.post(
  "/manual-media-reply",
upload.array("files", 10),
SocialAiBotController.manualMediaReply

);

export const SocialAiBotRoutes = router;
