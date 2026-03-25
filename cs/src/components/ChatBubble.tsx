interface ChatBubbleProps {
  type: "player" | "staff" | "system";
  content: string;
  authorName?: string;
  timestamp: string;
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  const hhmm = d.toLocaleTimeString("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  if (sameDay) return hhmm;

  const date = d.toLocaleDateString("zh-TW", {
    month: "numeric",
    day: "numeric",
  });
  return `${date} ${hhmm}`;
}

export function ChatBubble({
  type,
  content,
  authorName,
  timestamp,
}: ChatBubbleProps) {
  if (type === "system") {
    return (
      <div className="flex justify-center px-4 py-1">
        <div className="rounded-full bg-slate-100 px-4 py-1.5 text-xs text-slate-500 text-center max-w-md">
          {content}
          <span className="ml-2 text-slate-400">{timeLabel(timestamp)}</span>
        </div>
      </div>
    );
  }

  const isStaff = type === "staff";

  return (
    <div
      className={`flex gap-2 px-4 py-1 ${isStaff ? "flex-row-reverse" : "flex-row"}`}
    >
      {/* Avatar */}
      <div
        className={`mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-medium ${
          isStaff
            ? "bg-indigo-600 text-white"
            : "bg-slate-200 text-slate-700"
        }`}
      >
        {isStaff ? "客" : "玩"}
      </div>

      {/* Bubble */}
      <div className={`flex max-w-[70%] flex-col ${isStaff ? "items-end" : "items-start"}`}>
        {authorName && (
          <span className="mb-1 text-xs text-slate-500">{authorName}</span>
        )}
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isStaff
              ? "rounded-tr-sm bg-indigo-600 text-white"
              : "rounded-tl-sm bg-white text-slate-800 shadow-sm ring-1 ring-slate-200"
          }`}
        >
          <p className="whitespace-pre-wrap break-words">{content}</p>
        </div>
        <span className="mt-1 text-xs text-slate-400">{timeLabel(timestamp)}</span>
      </div>
    </div>
  );
}
