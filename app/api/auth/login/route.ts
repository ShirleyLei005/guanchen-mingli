import { NextRequest, NextResponse } from "next/server";
import { issueSession, verifyPassword } from "../../../../lib/auth";
import { getStore } from "../../../../lib/store";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { email?: string; password?: string } | null;
  const email = body?.email?.trim().toLowerCase() ?? "";
  const password = body?.password ?? "";
  if (!email || !password) {
    return NextResponse.json({ status: "error", code: "INVALID_INPUT", message: "请填写邮箱和密码" }, { status: 400 });
  }

  const store = await getStore();
  const user = await store.getUserByEmail(email);
  if (!user) {
    return NextResponse.json({ status: "error", code: "USER_NOT_FOUND", message: "该邮箱尚未注册，请先注册" }, { status: 404 });
  }
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ status: "error", code: "INVALID_CREDENTIALS", message: "邮箱或密码不正确" }, { status: 401 });
  }

  const response = NextResponse.json({
    status: "success",
    isNew: false,
    credits: await store.getBalance(user.id),
    message: "登录成功",
  });
  await issueSession(store, user.id, response);
  return response;
}
