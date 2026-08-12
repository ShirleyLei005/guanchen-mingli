import { sha256Hex } from "./auth";

export const VERIFICATION_CODE_TTL_MS = 30 * 60 * 1000;
export const VERIFICATION_MAX_ATTEMPTS = 5;
export const VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000;
export const REGISTRATION_MAX_PER_IP_PER_DAY = 10;
export const REGISTRATION_WINDOW_MS = 24 * 60 * 60 * 1000;

export function createVerificationCode() {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const value = ((bytes[0] << 16) | (bytes[1] << 8) | bytes[2]) % 1_000_000;
  return String(value).padStart(6, "0");
}

export async function hashVerificationCode(code: string) {
  return sha256Hex(`verification:${code}`);
}

export function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 2)}***@${domain ?? ""}`;
}
