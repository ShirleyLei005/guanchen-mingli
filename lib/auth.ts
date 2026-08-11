import { NextRequest, NextResponse } from "next/server";
import type { AppStore, StoreUser } from "./store";

export const SESSION_COOKIE = "guanchen_session";
export const NEW_USER_GIFT = 5;
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function createSessionToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashPassword(password: string) {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const saltBase64 = bytesToBase64(salt);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: 100_000 },
    key,
    256,
  );
  const hashBase64 = bytesToBase64(new Uint8Array(bits));
  return `pbkdf2_sha256$100000$${saltBase64}$${hashBase64}`;
}

export async function verifyPassword(password: string, stored: string) {
  if (!stored?.startsWith("pbkdf2_sha256$")) return false;
  const [, iterationsText, saltBase64, expectedBase64] = stored.split("$");
  const iterations = Number(iterationsText);
  if (!Number.isInteger(iterations) || iterations < 1) return false;
  const salt = base64ToBytes(saltBase64);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256,
  );
  const actual = bytesToBase64(new Uint8Array(bits));
  const expectedBytes = base64ToBytes(expectedBase64 ?? "");
  const actualBytes = base64ToBytes(actual);
  if (actualBytes.length !== expectedBytes.length) return false;
  let difference = 0;
  for (let index = 0; index < actualBytes.length; index += 1) {
    difference |= actualBytes[index] ^ expectedBytes[index];
  }
  return difference === 0;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export async function getSessionUser(request: NextRequest, store: AppStore): Promise<StoreUser | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token || token.length < 32) return null;
  const tokenHash = await sha256Hex(token);
  return store.getUserBySession(tokenHash);
}

export async function issueSession(store: AppStore, userId: string, response: NextResponse) {
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000).toISOString();
  await store.createSession({ tokenHash: await sha256Hex(token), userId, expiresAt });
  return setSessionCookie(response, token);
}
