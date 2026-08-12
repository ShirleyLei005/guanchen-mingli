const RESEND_ENDPOINT = "https://api.resend.com/emails";

export type VerificationEmailResult = {
  delivered: boolean;
  debugCode?: string;
};

export async function sendVerificationEmail(input: { to: string; code: string }): Promise<VerificationEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  const debugMode = process.env.ALLOW_DEBUG_VERIFICATION_CODE === "true";

  if (!apiKey || !from) {
    if (debugMode) return { delivered: false, debugCode: input.code };
    throw new Error("邮件验证服务尚未配置，暂时无法完成注册");
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: "观辰 · 邮箱验证码",
      html: `<p>欢迎来到观辰。你的验证码是：</p><p style="font-size:26px;letter-spacing:4px;font-weight:700">${input.code}</p><p>验证码 30 分钟内有效，请勿转发给他人。</p>`,
      text: `你的观辰验证码是 ${input.code}，30 分钟内有效。`,
    }),
  });
  if (!response.ok) {
    throw new Error("验证码邮件发送失败，请稍后重试");
  }
  return { delivered: true };
}
