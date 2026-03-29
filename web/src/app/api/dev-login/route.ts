import { NextResponse } from "next/server";
import crypto from "crypto";

const DEV_PLAYERS = [
  { id: "00000000-0000-0000-0000-000000000001", nickname: "玩家小明" },
  { id: "00000000-0000-0000-0000-000000000002", nickname: "玩家小花" },
  { id: "00000000-0000-0000-0000-000000000003", nickname: "觀戰者小王" },
];

function base64url(data: string): string {
  return Buffer.from(data).toString("base64url");
}

function generateJwt(playerId: string, secret: string): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(
    JSON.stringify({
      sub: playerId,
      iss: "prizedraw",
      iat: now,
      exp: now + 86400,
      jti: crypto.randomUUID(),
    }),
  );
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "JWT_SECRET not configured" }, { status: 500 });
  }

  const body = await request.json();
  const playerId = body.playerId as string;
  const player = DEV_PLAYERS.find((p) => p.id === playerId);
  if (!player) {
    return NextResponse.json({ error: "Unknown player" }, { status: 400 });
  }

  const accessToken = generateJwt(playerId, secret);

  return NextResponse.json({ accessToken, refreshToken: "dev-refresh-token" });
}

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }
  return NextResponse.json({ players: DEV_PLAYERS });
}
