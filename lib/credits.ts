import { NextRequest, NextResponse } from "next/server";

export const CREDIT_COOKIE = "guanchen_credits";
export const NEW_USER_CREDITS = 5;

export function readCredits(request: NextRequest) {
  const current = Number(request.cookies.get(CREDIT_COOKIE)?.value);
  return Number.isInteger(current) && current >= 0 ? current : NEW_USER_CREDITS;
}

export function setCreditCookie(response: NextResponse, credits: number) {
  response.cookies.set(CREDIT_COOKIE, String(Math.max(0, Math.floor(credits))), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

export function insufficientCredits(credits: number, cost: number) {
  return NextResponse.json(
    { status: "error", code: "INSUFFICIENT_CREDITS", message: `当前积分不足，本次需要 ${cost} 积分`, credits, requiredCredits: cost },
    { status: 402 },
  );
}
