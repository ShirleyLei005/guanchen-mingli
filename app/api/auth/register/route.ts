import { NextRequest, NextResponse } from "next/server";
import { hashPassword, issueSession, NEW_USER_GIFT, sha256Hex } from "../../../../lib/auth";
import { sendVerificationEmail } from "../../../../lib/email";
import { getStore } from "../../../../lib/store";
import {
  createVerificationCode,
  hashVerificationCode,
  maskEmail,
  REGISTRATION_MAX_PER_IP_PER_DAY,
  REGISTRATION_WINDOW_MS,
  VERIFICATION_CODE_TTL_MS,
  VERIFICATION_RESEND_COOLDOWN_MS,
} from "../../../../lib/verification";

const MAX_EMAIL_LENGTH = 254;
const MAX_PASSWORD_LENGTH = 128;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { email?: string; password?: string; displayName?: string; website?: string } | null;
  const email = body?.email?.trim().toLowerCase() ?? "";
  const password = body?.password ?? "";
  const displayName = body?.displayName?.trim().slice(0, 40) || email.split("@")[0] || "观辰用户";
  if (!email || email.length > MAX_EMAIL_LENGTH || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ status: "error", code: "INVALID_EMAIL", message: "请填写有效的邮箱地址" }, { status: 400 });
  }
  if (password.length < 6 || password.length > MAX_PASSWORD_LENGTH) {
    return NextResponse.json({ status: "error", code: "WEAK_PASSWORD", message: "密码至少需要 6 位字符" }, { status: 400 });
  }
  if (body?.website?.trim()) {
    return NextResponse.json({ status: "error", code: "BOT_DETECTED", message: "提交过于频繁，请稍后再试" }, { status: 400 });
  }

  const store = await getStore();
  const ip = request.headers.get("cf-connecting-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? "unknown";
  const ipHash = await sha256Hex(ip);
  const recentCount = await store.countRegistrationsByIp(ipHash, new Date(Date.now() - REGISTRATION_WINDOW_MS).toISOString());
  if (recentCount >= REGISTRATION_MAX_PER_IP_PER_DAY) {
    return NextResponse.json(
      { status: "error", code: "REGISTRATION_LIMITED", message: "同一网络今日注册次数过多，请明天再试" },
      { status: 429 },
    );
  }

  const existing = await store.getUserByEmail(email);
  if (existing) {
    return NextResponse.json({ status: "error", code: "EMAIL_TAKEN", message: "该邮箱已注册，请直接登录" }, { status: 409 });
  }

  const now = Date.now();
  const code = createVerificationCode();
  let sent;
  try {
    sent = await sendVerificationEmail({ to: email, code });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        code: "EMAIL_NOT_CONFIGURED",
        message: error instanceof Error ? error.message : "验证码邮件发送失败，请稍后重试",
      },
      { status: 503 },
    );
  }

  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  await store.createUser({ id: userId, email, displayName, passwordHash });
  await store.ensureCreditAccount(userId);
  await store.createEmailVerification({
    id: crypto.randomUUID(),
    userId,
    codeHash: await hashVerificationCode(code),
    expiresAt: new Date(now + VERIFICATION_CODE_TTL_MS).toISOString(),
    resendAfter: new Date(now + VERIFICATION_RESEND_COOLDOWN_MS).toISOString(),
  });
  await store.recordRegistrationEvent({ id: crypto.randomUUID(), ipHash, email, createdAt: new Date(now).toISOString() });

  const response = NextResponse.json({
    status: "success",
    isNew: true,
    verificationRequired: true,
    email,
    displayName,
    credits: 0,
    giftCredits: NEW_USER_GIFT,
    debugCode: sent?.debugCode,
    message: `验证码已发送至 ${maskEmail(email)}，验证通过后自动赠送 ${NEW_USER_GIFT} 积分。`,
  });
  await issueSession(store, userId, response);
  return response;
}
