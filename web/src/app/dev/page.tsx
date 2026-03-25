import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Developer Tools | PrizeDraw",
  robots: { index: false, follow: false },
};

interface DevTool {
  href: string;
  icon: string;
  title: string;
  titleZh: string;
  description: string;
  status: "ready" | "todo";
}

const DEV_TOOLS: DevTool[] = [
  {
    href: "/dev/animations",
    icon: "🎬",
    title: "Animation Showcase",
    titleZh: "動畫預覽",
    description:
      "Preview and interactively test all 4 draw animation modes (TEAR / SCRATCH / FLIP / INSTANT) with real-time state inspection and spectator view.",
    status: "ready",
  },
  {
    href: "/dev/design-system",
    icon: "🎨",
    title: "Design System",
    titleZh: "設計系統",
    description: "Component library preview — buttons, inputs, badges, cards, and all UI primitives.",
    status: "todo",
  },
  {
    href: "/dev/api-explorer",
    icon: "🔌",
    title: "API Explorer",
    titleZh: "API 探索器",
    description: "Send test requests to all backend endpoints and inspect raw responses inline.",
    status: "todo",
  },
  {
    href: "/dev/websocket-monitor",
    icon: "📊",
    title: "WebSocket Monitor",
    titleZh: "WebSocket 監控",
    description: "Live viewer of all WebSocket events — draw progress, spectator syncs, and pub/sub messages.",
    status: "todo",
  },
];

export default function DevIndexPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🛠</span>
            <div>
              <h1 className="text-2xl font-bold text-white">Developer Tools</h1>
              <p className="text-sm text-gray-400 mt-0.5">
                Internal tooling for the PrizeDraw team — not visible in production.
              </p>
            </div>
          </div>

          {/* Environment badge */}
          <div className="mt-4 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/25">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              NODE_ENV: development
            </span>
            <span className="text-xs text-gray-500">
              This route group is only linked in dev mode.
            </span>
          </div>
        </div>
      </div>

      {/* Tool cards */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid gap-4 sm:grid-cols-2">
          {DEV_TOOLS.map((tool) => (
            <ToolCard key={tool.href} tool={tool} />
          ))}
        </div>

        {/* Footer note */}
        <p className="mt-10 text-xs text-gray-600 text-center">
          These pages are excluded from the production sitemap and are protected by{" "}
          <code className="text-gray-500">NODE_ENV</code> gating. Do not deploy to production without review.
        </p>
      </div>
    </div>
  );
}

function ToolCard({ tool }: { tool: DevTool }) {
  const isReady = tool.status === "ready";

  const card = (
    <div
      className={[
        "group relative rounded-xl border p-5 transition-all duration-200",
        isReady
          ? "border-gray-700 bg-gray-900 hover:border-indigo-500/60 hover:bg-gray-800/80 cursor-pointer"
          : "border-gray-800 bg-gray-900/50 opacity-60 cursor-not-allowed",
      ].join(" ")}
    >
      {/* Status pill */}
      <div className="absolute top-4 right-4">
        {isReady ? (
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 font-medium">
            Ready
          </span>
        ) : (
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700/60 text-gray-500 border border-gray-700 font-medium">
            TODO
          </span>
        )}
      </div>

      {/* Icon */}
      <div className="text-3xl mb-3">{tool.icon}</div>

      {/* Titles */}
      <h2 className="font-bold text-white text-base leading-snug">
        {tool.titleZh}
        <span className="ml-2 text-gray-400 font-normal text-sm">— {tool.title}</span>
      </h2>

      {/* Description */}
      <p className="mt-2 text-sm text-gray-400 leading-relaxed">{tool.description}</p>

      {/* Arrow indicator for ready items */}
      {isReady && (
        <div className="mt-4 flex items-center gap-1 text-xs text-indigo-400 font-medium group-hover:gap-2 transition-all">
          <span>Open tool</span>
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
          </svg>
        </div>
      )}
    </div>
  );

  if (!isReady) return card;
  return <Link href={tool.href}>{card}</Link>;
}
