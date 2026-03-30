import { NextResponse } from "next/server";
import crypto from "crypto";

const DEV_STAFF = [
  { id: "00000000-0000-0000-0000-000000000901", name: "管理員", role: "ADMIN" },
];

function base64url(data: string): string {
  return Buffer.from(data).toString("base64url");
}

function generateJwt(staffId: string, role: string, secret: string): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(
    JSON.stringify({
      sub: staffId,
      iss: "prizedraw",
      iat: now,
      exp: now + 86400,
      role,
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
  const role = (body.role as string) ?? "ADMIN";
  const staff = DEV_STAFF.find((s) => s.role === role) ?? DEV_STAFF[0];

  const accessToken = generateJwt(staff.id, staff.role, secret);

  return NextResponse.json({
    accessToken,
    staffId: staff.id,
    name: staff.name,
    role: staff.role,
  });
}
