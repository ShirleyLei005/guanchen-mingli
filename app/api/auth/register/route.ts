import { NextRequest, NextResponse } from "next/server";
import { hashPassword, issueSession, NEW_USER_GIFT } from "../../../../lib/auth";
import { getStore } from "../../../../lib/store";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { email?: string; password?: string; displayName?: string } | null;
  const email = body?.email?.trim().toLowerCase() ?? "";
  const password = body?.password ?? "";
  const displayName = body?.displayName?.trim().slice(0, 40) || email.split("@")[0] || "观辰用户";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ status: "error", code: "INVALID_EMAIL", message: "请填写有效的邮箱地址" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ status: "error", code: "WEAK_PASSWORD", message: "密码至少需要 6 位字符" }, { status: 400 });
  }

  const store = await getStore();
  const existing = await store.getUserByEmail(email);
  if (existing) {
    return NextResponse.json({ status: "error", code: "EMAIL_TAKEN", message: "该邮箱已注册，请直接登录" }, { status: 409 });
  }

  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  await store.createUser({ id: userId, email, displayName, passwordHash });
  await store.ensureCreditAccount(userId);
  const gift = await store.credit(userId, NEW_USER_GIFT, {
    kind: "signup_gift",
    referenceType: "user",
    referenceId: userId,
    idempotencyKey: `signup:${userId}`,
  });

  const response = NextResponse.json({
    status: "success",
    isNew: true,
    credits: gift.balanceAfter,
    giftCredits: NEW_USER_GIFT,
    message: `注册成功，已赠送 ${NEW_USER_GIFT} 积分，可解锁八字或紫微斗数完整报告。`,
  });
  await issueSession(store, userId, response);
  return response;
}
