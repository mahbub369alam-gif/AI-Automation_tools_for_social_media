"use client";

type Item = {
  conversationId: string;
  customerName: string;
  platform: string;
  lastMessage: string;
  lastTime: string;
};

export default function ConversationList({
  items,
  activeId,
  onSelect,
}: {
  items: Item[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#ff2a6d]">
        <h2 className="text-[#ff2a6d] font-semibold text-lg">Customers</h2>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto">
        {items.map((c) => {
          const isActive = c.conversationId === activeId;
          return (
            <button
              key={c.conversationId}
              onClick={() => onSelect(c.conversationId)}
              className={[
                "w-full text-left px-5 py-4 border-b border-[#ff2a6d] hover:bg-gray-50 transition",
                isActive ? "bg-gray-50" : "bg-white",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div
                    className={[
                      "font-semibold truncate",
                      isActive ? "text-[#ff2a6d]" : "text-[#ff2a6d]",
                    ].join(" ")}
                  >
                    {c.customerName || c.conversationId}
                  </div>

                  <div className="text-gray-700 text-sm truncate mt-1">
                    {c.lastMessage}
                  </div>

                  <div className="text-gray-500 text-xs mt-2">
                    {new Date(c.lastTime).toLocaleString()}
                  </div>
                </div>

                <div className="text-xs text-gray-500 shrink-0 mt-1">
                  {c.platform}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
