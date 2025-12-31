"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LiveMsg } from "@/types/chat";

export default function ChatWindow({
  title,
  messages,
  conversationId,
}: {
  title: string;
  messages: LiveMsg[];
  conversationId: string | null;
}) {
  const API = process.env.NEXT_PUBLIC_API_URL || "";

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [errMsg, setErrMsg] = useState<string>("");

  const listRef = useRef<HTMLDivElement | null>(null);

  // extract image urls from message text
  const extractImageUrls = (t: string) => {
    if (!t) return [];
    if (t.startsWith("📷 Images:")) {
      return t
        .split("\n")
        .slice(1)
        .map((s) => s.trim())
        .filter(Boolean);
    }
    if (t.includes("📷 Image:")) {
      const u = t.split("📷 Image:")[1]?.trim();
      return u ? [u] : [];
    }
    const matches = t.match(/https?:\/\/\S+/g);
    return matches || [];
  };

  const isProbablyImageUrl = (url: string) => {
  if (!url) return false;

  // ✅ fb/ig cdn
  if (url.includes("fbcdn.net") || url.includes("scontent")) return true;

  // ✅ our uploads (ngrok/local)
  if (url.includes("/uploads/")) return true;

  // ✅ normal extensions
  return /\.(png|jpg|gif|webp)(\?|$)/i.test(url);
};





  const extractVideoUrl = (t: string) => {
    if (!t) return "";
    if (t.startsWith("🎥 Video:")) return t.split("🎥 Video:")[1]?.trim() || "";
    const match = t.match(/https?:\/\/\S+/g)?.[0] || "";
    return /\.(mp4|mov|webm)(\?|$)/i.test(match) ? match : "";
  };

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const handleSendText = async () => {
    const msg = text.trim();
    if (!msg || !conversationId) return;

    try {
      setErrMsg("");
      setSending(true);

      const res = await fetch(`${API}/api/social-ai-bot/manual-reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: msg }),
      });

      if (!res.ok) {
        const t = await res.text();
        console.error("manual-reply failed:", t);
        setErrMsg(t || "Send failed");
        return;
      }

      setText("");
    } catch (e: any) {
      console.error(e);
      setErrMsg(e?.message || "Send failed");
    } finally {
      setSending(false);
    }
  };

      const handleSendMedia = async () => {
        if (!conversationId || files.length === 0) return;

        try {
          setErrMsg("");
          setSending(true);

          const form = new FormData();
          form.append("conversationId", conversationId);

          // ✅ multiple append
          files.forEach((f) => form.append("files", f));

          const res = await fetch(`${API}/api/social-ai-bot/manual-media-reply`, {
            method: "POST",
            body: form,
          });

          const body = await res.text();
          if (!res.ok) {
            console.error("manual-media-reply failed:", body);
            setErrMsg(body || "Media send failed");
            return;
          }

          setFiles([]);
        } catch (e: any) {
          console.error(e);
          setErrMsg(e?.message || "Media send failed");
        } finally {
          setSending(false);
        }
      };




      const smartSend = () => {
        if (sending) return;
        if (files.length > 0) return handleSendMedia();
        return handleSendText();
      };


  const headerId = useMemo(() => conversationId || "", [conversationId]);

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="border-b border-[#ff2a6d]">
        <div className="px-6 py-4">
          <div className="text-[#ff2a6d] font-semibold text-xl truncate">
            {headerId ? headerId : title}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-auto px-8 py-6">
        <div className="space-y-6">
          {messages.map((m, idx) => {
            const isBot = m.sender === "bot";
            const time = m.timestamp ? new Date(m.timestamp).toLocaleString() : "";

            const urls = extractImageUrls(m.message || "").filter(isProbablyImageUrl);
            const showImages = urls.length > 0;

            const videoUrl = extractVideoUrl(m.message || "");
            const showVideo = !!videoUrl;

            return (
              <div
                key={`${m.timestamp}-${idx}`}
                className={["w-full flex", isBot ? "justify-end" : "justify-start"].join(" ")}
              >
                <div
                  className={[
                    "max-w-[780px] px-5 py-4 text-sm leading-relaxed",
                    "border-2 border-black rounded-xl bg-white",
                    "transition-colors duration-150 hover:bg-gray-50",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <div className="text-[12px] font-medium">{isBot ? "bot" : "cus"}</div>
                    <div className="text-[11px] text-gray-500">{time}</div>
                  </div>

                  {showVideo ? (
                    <video
                      src={videoUrl}
                      controls
                      className="w-full max-w-[520px] rounded-lg border border-black"
                    />
                  ) : showImages ? (
                    <div className="grid grid-cols-2 gap-3">
                      {urls.map((u, i) => (
                        <img
                          key={`${u}-${i}`}
                          src={u}
                          alt={`attachment-${i + 1}`}
                          className="w-full rounded-lg border border-black"
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">{m.message}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Divider */}
      <div className="w-full border-t-2 border-black" />

      {/* Bottom pill input (like screenshot) */}
      <div className="px-16 pb-6">
        <div className="bg-[#2b2b2b] rounded-full px-4 py-3 flex items-center gap-3 shadow-inner">
          {/* hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
            disabled={!conversationId || sending}
          />


          {/* + */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!conversationId || sending}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-2xl hover:bg-[#3a3a3a] disabled:opacity-50"
            title="Attach"
          >
            +
          </button>

          {/* input */}
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") smartSend();
            }}
            placeholder={files.length ? `selected: ${files.length} file(s)` : "type your message"}
            disabled={!conversationId || sending}
            className="flex-1 bg-transparent outline-none text-white placeholder-gray-400 text-base"
          />
          
          

          {/* send */}
          <button
            type="button"
            onClick={smartSend}
            disabled={!conversationId || sending || (!text.trim() && files.length === 0)}

            className="w-10 h-10 rounded-full bg-white flex items-center justify-center disabled:opacity-50"
            title="Send"
          >
            ↑
          </button>
        </div>

        {/* file + error */}
       {files.length > 0 && (
              <div className="mt-2 text-sm text-gray-400">
                Selected: <span className="font-medium">{files.length} file(s)</span>
                <button type="button" className="ml-2 underline" onClick={() => setFiles([])}>
                  remove
                </button>
              </div>
            )}


        {errMsg && (
          <div className="mt-2 text-sm text-red-600">
            {errMsg}
          </div>
        )}
      </div>
    </div>
  );
}
