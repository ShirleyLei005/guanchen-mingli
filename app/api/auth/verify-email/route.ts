import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, NEW_USER_GIFT } from "../../../../lib/auth";
import { getStore } from "../../../../lib/store";
import { hashVerificationCode, VERIFICATION_MAX_ATTEMPTS } from "../../../../lib/verification";

export async function POST(request: NextRequest) {
  const store = await getStore();
  const user = await getSessionUser(request, store);
  if (!user) {
    return NextResponse.json({ status: "error", code: "AUTH_REQUIRED", message: "请先登录后再验证邮箱" }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as { code?: string } | null;
  const code = body?.code?.trim() ?? "";
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ status: "error", code: "INVALID_CODE", message: "请输入 6 位数字验证码" }, { status: 400 });
  }

  if (user.emailVerifiedAt) {
    return NextResponse.json({
      status: "success",
      verified: true,
      credits: await store.getBalance(user.id),
      giftCredits: 0,
      message: "邮箱已验证，当前积分可用。",
    });
  }

  const verification = await store.getEmailVerification(user.id);
  if (!verification || verification.completedAt) {
    return NextResponse.json({ status: "error", code: "VERIFICATION_EXPIRED", message: "验证码不存在或已失效，请重新发送" }, { status: 410 });
  }
  if (new Date(verification.expiresAt).getTime() < Date.now()) {
    return NextResponse.json({ status: "error", code: "VERIFICATION_EXPIRED", message: "验证码已过期，请重新发送" }, { status: 410 });
  }
  if (verification.attempts >= VERIFICATION_MAX_ATTEMPTS) {
    return NextResponse.json({ status: "error", code: "VERIFICATION_TOO_MANY_ATTEMPTS", message: "尝试次数过多，请重新发送验证码" }, { status: 429 });
  }

  const actual = await hashVerificationCode(code);
  if (actual !== verification.codeHash) {
    await store.incrementVerificationAttempt(user.id);
    return NextResponse.json({ status: "error", code: "INVALID_CODE", message: "验证码不正确，请重新输入" }, { status: 400 });
  }

  await store.markEmailVerified(user.id);
  const gift = await store.credit(user.id, NEW_USER_GIFT, {
    kind: "signup_gift",
    referenceType: "user",
    referenceId: user.id,
    idempotencyKey: `signup:${user.id}`,
  });
  return NextResponse.json({
    status: "success",
    verified: true,
    displayName: user.displayName,
    email: user.email,
    credits: gift.balanceAfter,
    giftCredits: gift.applied ? NEW_USER_GIFT : 0,
    message: `邮箱验证成功，已赠送 ${NEW_USER_GIFT} 积分，可解锁八字或紫微斗数完整报告。`,
  });
}
