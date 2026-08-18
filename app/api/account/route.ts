import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, hashPassword, verifyPassword } from "../../../lib/auth";
import { getStore } from "../../../lib/store";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(request: NextRequest) {
  const store = await getStore();
  const user = await getSessionUser(request, store);
  if (!user) return NextResponse.json({ status: "error", message: "请先登录" }, { status: 401 });
  return NextResponse.json({ status: "success", displayName: user.displayName, email: user.email, emailVerified: Boolean(user.emailVerifiedAt) });
}

export async function PATCH(request: NextRequest) {
  const store = await getStore();
  const user = await getSessionUser(request, store);
  if (!user) return NextResponse.json({ status: "error", message: "请先登录" }, { status: 401 });
  const body = await request.json().catch(() => null) as { displayName?: string; email?: string; currentPassword?: string; newPassword?: string } | null;
  const displayName = body?.displayName?.trim().slice(0, 30) || "";
  const email = body?.email?.trim().toLowerCase() || "";
  const changingEmail = email !== user.email;
  const changingPassword = Boolean(body?.newPassword);
  if (displayName.length < 2) return NextResponse.json({ status: "error", message: "用户名称至少需要 2 个字符" }, { status: 400 });
  if (!emailPattern.test(email)) return NextResponse.json({ status: "error", message: "请输入有效的电子邮箱" }, { status: 400 });
  if (changingPassword && (body?.newPassword?.length || 0) < 8) return NextResponse.json({ status: "error", message: "新密码至少需要 8 个字符" }, { status: 400 });
  if ((changingEmail || changingPassword) && !await verifyPassword(body?.currentPassword || "", user.passwordHash)) {
    return NextResponse.json({ status: "error", message: "当前密码不正确" }, { status: 401 });
  }
  const emailOwner = changingEmail ? await store.getUserByEmail(email) : null;
  if (emailOwner && emailOwner.id !== user.id) return NextResponse.json({ status: "error", message: "该邮箱已被其他账号使用" }, { status: 409 });
  try {
    const updated = await store.updateUser({
      userId: user.id,
      email,
      displayName,
      passwordHash: changingPassword ? await hashPassword(body!.newPassword!) : user.passwordHash,
      emailVerifiedAt: changingEmail ? null : user.emailVerifiedAt,
    });
    return NextResponse.json({ status: "success", displayName: updated.displayName, email: updated.email, emailVerified: Boolean(updated.emailVerifiedAt), verificationRequired: changingEmail, message: changingEmail ? "资料已保存，请验证新的电子邮箱。" : "账号设置已保存。" });
  } catch {
    return NextResponse.json({ status: "error", message: "账号设置保存失败，请稍后重试" }, { status: 500 });
  }
}
