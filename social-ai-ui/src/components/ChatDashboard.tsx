"use client";

import { useEffect, useMemo, useState } from "react";
import { getSocket } from "@/lib/socket";
import { LiveMsg } from "@/types/chat";
import ConversationList from "./ConversationList";
import ChatWindow from "./ChatWindow";

type ConversationsMap = Record<string, LiveMsg[]>;

export default function ChatDashboard() {
  const [conversations, setConversations] = useState<ConversationsMap>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // ✅ IMPORTANT: API base (avoid /undefined)
  const API = process.env.NEXT_PUBLIC_API_URL || "";

  // 1) ✅ Load history from DB on first load
  useEffect(() => {
    const loadHistory = async () => {
      try {
        setLoadingHistory(true);

        // 1) get conversation list
        const convRes = await fetch(`${API}/api/social-ai-bot/conversations`);
        if (!convRes.ok) throw new Error(`conversations fetch failed: ${convRes.status}`);
        const convs: Array<{ conversationId: string }> = await convRes.json();

        // 2) fetch messages for each conversation
        const entries = await Promise.all(
          convs.map(async (c) => {
            const msgRes = await fetch(
              `${API}/api/social-ai-bot/messages/${encodeURIComponent(c.conversationId)}`
            );
            if (!msgRes.ok) return [c.conversationId, [] as LiveMsg[]] as const;

            const msgs: LiveMsg[] = await msgRes.json();
            return [c.conversationId, msgs] as const;
          })
        );

        const map: ConversationsMap = {};
        for (const [id, msgs] of entries) map[id] = msgs;

        setConversations(map);

        // auto select first conversation (latest)
        const ids = Object.keys(map);
        if (ids.length > 0) {
          const sorted = ids
            .map((id) => {
              const last = map[id]?.[map[id].length - 1];
              return { id, t: last?.timestamp ? new Date(last.timestamp).getTime() : 0 };
            })
            .sort((a, b) => b.t - a.t);

          setActiveId(sorted[0].id);
        }
      } catch (e) {
        console.error("loadHistory error:", e);
      } finally {
        setLoadingHistory(false);
      }
    };

    loadHistory();
  }, [API]);

  // 2) ✅ Socket live updates
  useEffect(() => {
    const socket = getSocket();

    socket.on("connect", () => {
      console.log("UI connected:", socket.id);
    });

    socket.on("new_message", (msg: LiveMsg) => {
      setConversations((prev) => {
        const list = prev[msg.conversationId] || [];

        // avoid duplicates (same timestamp + sender + message)
        const exists = list.some(
          (x) =>
            x.timestamp === msg.timestamp &&
            x.sender === msg.sender &&
            x.message === msg.message
        );
        if (exists) return prev;

        return { ...prev, [msg.conversationId]: [...list, msg] };
      });

      // safe auto-select first conversation if none selected
      setActiveId((prevActive) => prevActive ?? msg.conversationId);
    });

    return () => {
      socket.off("new_message");
      socket.off("connect");
    };
  }, []);

  const sidebarItems = useMemo(() => {
    const ids = Object.keys(conversations);
    return ids
      .map((id) => {
        const msgs = conversations[id] || [];
        const last = msgs[msgs.length - 1];
        return {
          conversationId: id,
          customerName: last?.customerName || id,
          platform: last?.platform || "facebook",
          lastMessage: last?.message || "",
          lastTime: last?.timestamp || new Date().toISOString(),
        };
      })
      .sort((a, b) => new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime());
  }, [conversations]);

  const activeMessages = activeId ? conversations[activeId] || [] : [];
  const activeTitle = activeId
    ? `${activeMessages[0]?.customerName || activeId}`
    : "Select a customer";

  return (
    <div className="h-[calc(100vh-0px)] grid grid-cols-12">
      <div className="col-span-4 md:col-span-3 bg-white border-r border-[#ff2a6d]">
        <ConversationList items={sidebarItems} activeId={activeId} onSelect={setActiveId} />
      </div>

      <div className="col-span-8 md:col-span-9 bg-white">
        {/* optional: loading indicator */}
        {loadingHistory && (
          <div className="px-6 py-3 text-sm text-gray-500">Loading history...</div>
        )}

        <ChatWindow title={activeTitle} messages={activeMessages} conversationId={activeId} />
      </div>
    </div>
  );
}
