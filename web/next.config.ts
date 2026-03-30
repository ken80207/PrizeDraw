import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        // Proxy /ws/* to the realtime-gateway in development.
        // The Next.js dev server forwards HTTP upgrade requests (WebSocket
        // handshakes) to external rewrite destinations via http-proxy, so
        // WebSocket connections to ws://localhost:3000/ws/* are transparently
        // forwarded to ws://localhost:9094/ws/*.
        source: "/ws/:path*",
        destination: "http://localhost:9094/ws/:path*",
      },
    ];
  },
};

export default withNextIntl(nextConfig);
