import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, sha256Hex, SESSION_COOKIE } from "../../../../lib/auth";
import { getStore } from "../../../../lib/store";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    const store = await getStore();
    await store.deleteSession(await sha256Hex(token));
  }
  return clearSessionCookie(NextResponse.json({ status: "success", message: "已退出登录" }));
}
