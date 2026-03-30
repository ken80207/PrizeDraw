/**
 * Session management Route Handler.
 *
 * POST /api/auth/session
 *   Accepts { accessToken, refreshToken, expiresIn } from the OAuth login flow
 *   and stores them as httpOnly cookies so that server components and middleware
 *   can verify authentication without reading localStorage.
 *
 * DELETE /api/auth/session
 *   Clears the session cookies (logout).
 *
 * This route is called by:
 * - The production OAuth login flow in (auth)/login/page.tsx after a successful
 *   /api/v1/auth/login response.
 * - The dev login panel in (auth)/login/page.tsx after a successful /api/dev-login
 *   response (in development only).
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const ACCESS_TOKEN_COOKIE = "pd_access_token";
const REFRESH_TOKEN_COOKIE = "pd_refresh_token";

interface SessionPayload {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
}

export async function POST(request: Request) {
  let body: SessionPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { accessToken, refreshToken, expiresIn } = body;

  if (!accessToken || !refreshToken) {
    return NextResponse.json(
      { error: "accessToken and refreshToken are required" },
      { status: 400 }
    );
  }

  const cookieStore = await cookies();

  // Default expiry: 24 hours for access token, 30 days for refresh token.
  const accessMaxAge = typeof expiresIn === "number" ? expiresIn : 86400;
  const refreshMaxAge = 60 * 60 * 24 * 30;

  const isProduction = process.env.NODE_ENV === "production";

  cookieStore.set(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: accessMaxAge,
  });

  cookieStore.set(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: refreshMaxAge,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(ACCESS_TOKEN_COOKIE);
  cookieStore.delete(REFRESH_TOKEN_COOKIE);
  return NextResponse.json({ ok: true });
}
