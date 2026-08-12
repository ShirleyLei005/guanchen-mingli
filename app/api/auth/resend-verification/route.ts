import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "../../../../lib/auth";
import { sendVerificationEmail } from "../../../../lib/email";
import { getStore } from "../../../../lib/store";
import {
  createVerificationCode,
  hashVerificationCode,
  maskEmail,
  VERIFICATION_CODE_TTL_MS,
  VERIFICATION_RESEND_COOLDOWN_MS,
} from "../../../../lib/verification";

export async function POST(request: NextRequest) {
  const store = await getStore();
  const user = await getSessionUser(request, store);
  if (!user) {
    return NextResponse.json({ status: "error", code: "AUTH_REQUIRED", message: "请先登录后再重新发送验证码" }, { status: 401 });
  }
  if (user.emailVerifiedAt) {
    return NextResponse.json({ status: "error", code: "ALREADY_VERIFIED", message: "邮箱已验证，无需重新发送" }, { status: 400 });
  }

  const verification = await store.getEmailVerification(user.id);
  if (verification?.resendAfter && new Date(verification.resendAfter).getTime() > Date.now()) {
    const waitSeconds = Math.ceil((new Date(verification.resendAfter).getTime() - Date.now()) / 1000);
    return NextResponse.json(
      { status: "error", code: "VERIFICATION_RESEND_LIMITED", message: `请 ${waitSeconds} 秒后再重新发送` },
      { status: 429 },
    );
  }

  const now = Date.now();
  const code = createVerificationCode();
  let sent;
  try {
    sent = await sendVerificationEmail({ to: user.email, code });
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

  await store.createEmailVerification({
    id: crypto.randomUUID(),
    userId: user.id,
    codeHash: await hashVerificationCode(code),
    expiresAt: new Date(now + VERIFICATION_CODE_TTL_MS).toISOString(),
    resendAfter: new Date(now + VERIFICATION_RESEND_COOLDOWN_MS).toISOString(),
  });
  return NextResponse.json({
    status: "success",
    debugCode: sent?.debugCode,
    message: `验证码已重新发送至 ${maskEmail(user.email)}。`,
  });
}
