import { NextRequest, NextResponse } from "next/server";
import { CREDIT_COOKIE, NEW_USER_CREDITS, readCredits, setCreditCookie } from "../../../../lib/credits";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { email?: string; password?: string } | null;
  if (!body?.email?.includes("@") || (body.password?.length ?? 0) < 6) {
    return NextResponse.json({ status: "error", message: "请填写有效邮箱和至少 6 位密码" }, { status: 400 });
  }
  const isNew = !request.cookies.has(CREDIT_COOKIE);
  const credits = isNew ? NEW_USER_CREDITS : readCredits(request);
  return setCreditCookie(NextResponse.json({ status: "success", credits, isNew }), credits);
}
