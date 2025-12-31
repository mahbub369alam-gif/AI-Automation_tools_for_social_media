# 📩 Social AI Bot – Live Chat Dashboard

A full-stack **Social Media AI Chat System** that connects **Facebook & Instagram Inbox**
with a **real-time admin dashboard**, supporting **live chat, image/video sharing,
AI auto-replies, and conversation history**.

---

## ✨ Features

- 📡 Facebook & Instagram Webhook Integration  
- 💬 Real-time Live Chat (Socket.IO)  
- 🤖 AI Auto Reply (Groq / LLaMA)  
- 🧠 Conversation Context Memory  
- 📸 Image & 🎥 Video Message Support  
- 📂 Multiple Media Upload Support  
- 🧾 Conversation History (MongoDB)  
- 🧑‍💻 Manual Reply from Admin Dashboard  
- 🔄 Page Inbox → Live UI Sync (Echo Message Handling)  

---

## 🧱 Tech Stack

### Backend
- Node.js
- Express.js
- TypeScript
- MongoDB + Mongoose
- Socket.IO
- Multer (Media Upload)
- Axios
- Groq SDK (LLaMA)

### Frontend
- Next.js (React)
- TypeScript
- Tailwind CSS
- Socket.IO Client

---

## 📁 Project Structure

src/
├── app/
│ ├── modules/
│ │ └── socialAiBot/
│ │ ├── socialAiBot.controller.ts
│ │ ├── socialAiBot.route.ts
│ │ ├── socialAiBot.message.model.ts
│ │ └── products.xlsx
│ └── app.ts
│
├── components/
│ ├── ChatDashboard.tsx
│ └── ChatWindow.tsx
│
├── uploads/ # Uploaded images & videos
└── types/
└── chat.ts

yaml
Copy code

---

## ⚙️ Environment Variables

Create a `.env` file in the backend root:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/social-ai-bot

WEBHOOK_VERIFY_TOKEN=your_verify_token
PUBLIC_BASE_URL=https://your-ngrok-url.ngrok-free.dev

GROQ_API_KEY=your_groq_api_key
⚠️ Important

PUBLIC_BASE_URL must be a public HTTPS URL

Required for Facebook/Instagram image & video delivery

▶️ Run Backend
bash
Copy code
npm install
npm run dev
Backend runs at:

arduino
Copy code
http://localhost:5000
Health check:

bash
Copy code
GET /health
▶️ Run Frontend
bash
Copy code
npm install
npm run dev
Frontend runs at:

arduino
Copy code
http://localhost:3000
🔗 API Endpoints
Webhook
swift
Copy code
GET  /api/social-ai-bot/facebook/webhook
POST /api/social-ai-bot/facebook/webhook
Conversations
swift
Copy code
GET /api/social-ai-bot/conversations
GET /api/social-ai-bot/messages/:conversationId
Manual Text Reply (Admin)
bash
Copy code
POST /api/social-ai-bot/manual-reply
Manual Media Reply (Image / Video)
bash
Copy code
POST /api/social-ai-bot/manual-media-reply

FormData:
- conversationId
- files[] (multiple image/video)
🖼️ Media Upload Rules
Supported: Image & Video

Recommended max size: 8–10 MB

Files stored in /uploads

Public access:

bash
Copy code
{PUBLIC_BASE_URL}/uploads/<filename>
🤖 AI Bot Behavior
Replies in the same language as the user (Bangla / English)

Short, polite replies (1–2 lines)

If customer sends an image, bot replies:

Copy code
ধন্যবাদ! ছবিটা পেয়েছি দয়া করে আপনার whatsapp নাম্বার দিন,
আমাদের একজন প্রতিনিধি শিগ্রই আপনার সাথে যোগাযোগ করবে।
Product prices are loaded from products.xlsx

Never guesses prices

🔄 Live Message Flow
Customer messages Facebook / Instagram Page

Meta Webhook triggers backend

Message saved in database

Socket emits new_message

Admin UI updates instantly

✔️ Page Inbox messages also appear in Live UI
✔️ No AI auto-reply on admin echo messages

🧪 Common Issues
Media send fails
Ensure PUBLIC_BASE_URL is HTTPS

File size not too large

ngrok / tunnel running

Page Inbox message not showing
message_echoes enabled in Meta App

Webhook subscriptions configured correctly

📌 Future Improvements
Admin authentication

Multi-agent support

Typing indicators

Read receipts

Cloud storage (S3 / Cloudinary)

👤 Author
Mahbub Alam
📧 onigenius.og@gmail.com
