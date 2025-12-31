import { LiveMsg } from "@/types/chat";

export default function MessageBubble({ msg }: { msg: LiveMsg }) {
  const isBot = msg.sender === "bot";

  return (
    <div className={["w-full flex", isBot ? "justify-end" : "justify-start"].join(" ")}>
      <div className={["max-w-[720px] px-4 py-3 rounded-2xl text-sm leading-relaxed",
        isBot ? "bg-[#1e66ff] text-white rounded-br-md" : "bg-gray-100 text-gray-900 rounded-bl-md"
      ].join(" ")}>
        <div className="text-[11px] opacity-80 mb-1">
          {isBot ? `bot • ${new Date(msg.timestamp).toLocaleString()}` : `cus • ${new Date(msg.timestamp).toLocaleString()}`}
        </div>
        <div className="whitespace-pre-wrap">{msg.message}</div>
      </div>
    </div>
  );
}
