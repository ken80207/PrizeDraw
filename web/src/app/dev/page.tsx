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
    <div className="p-6 lg:p-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-3xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>build</span>
          <div>
            <h1 className="text-2xl font-black text-on-surface font-headline">Developer Tools</h1>
            <p className="text-sm text-on-surface-variant mt-0.5">
              Internal tooling for the PrizeDraw team — not visible in production.
            </p>
          </div>
        </div>

        {/* Environment badge */}
        <div className="mt-4 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-primary/10 text-primary">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            NODE_ENV: development
          </span>
          <span className="text-xs text-on-surface-variant/50">
            This route group is only linked in dev mode.
          </span>
        </div>
      </div>

      {/* Tool cards */}
      <div className="grid gap-4 sm:grid-cols-2 max-w-4xl">
        {DEV_TOOLS.map((tool) => (
          <ToolCard key={tool.href} tool={tool} />
        ))}
      </div>

      {/* Footer note */}
      <p className="mt-10 text-xs text-on-surface-variant/30 text-center max-w-4xl">
        These pages are excluded from the production sitemap and are protected by{" "}
        <code className="text-on-surface-variant/50">NODE_ENV</code> gating.
      </p>
    </div>
  );
}

function ToolCard({ tool }: { tool: DevTool }) {
  const isReady = tool.status === "ready";

  const card = (
    <div
      className={[
        "group relative rounded-lg p-5 transition-all duration-200",
        isReady
          ? "bg-surface-container hover:bg-surface-container-high cursor-pointer gacha-glow"
          : "bg-surface-container/50 opacity-60 cursor-not-allowed",
      ].join(" ")}
    >
      {/* Status pill */}
      <div className="absolute top-4 right-4">
        {isReady ? (
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-medium">
            Ready
          </span>
        ) : (
          <span className="text-xs px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant/50 font-medium">
            TODO
          </span>
        )}
      </div>

      {/* Icon */}
      <div className="text-3xl mb-3">{tool.icon}</div>

      {/* Titles */}
      <h2 className="font-bold text-on-surface text-base leading-snug font-headline">
        {tool.titleZh}
        <span className="ml-2 text-on-surface-variant font-normal text-sm">— {tool.title}</span>
      </h2>

      {/* Description */}
      <p className="mt-2 text-sm text-on-surface-variant leading-relaxed">{tool.description}</p>

      {/* Arrow indicator for ready items */}
      {isReady && (
        <div className="mt-4 flex items-center gap-1 text-xs text-primary font-bold group-hover:gap-2 transition-all">
          <span>Open tool</span>
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </div>
      )}
    </div>
  );

  if (!isReady) return card;
  return <Link href={tool.href}>{card}</Link>;
}
