// 微信支付 / 支付宝共用的 Web Crypto 工具。
// 只依赖 Workers 与 Node 22+ 自带的 Web Crypto，不引入额外加解密库。

const RSA_ALGORITHM = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" } as const;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

type PemResult = { der: Uint8Array; label: string };

export function pemToDer(pem: string): PemResult {
  const header = pem.match(/-----BEGIN ([A-Z0-9 ]+)-----/);
  const body = pem
    .replace(/-----BEGIN [A-Z0-9 ]+-----/, "")
    .replace(/-----END [A-Z0-9 ]+-----/, "")
    .replace(/\s+/g, "");
  if (!body) throw new Error("PEM 内容为空");
  const binary = atob(body);
  const der = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) der[index] = binary.charCodeAt(index);
  return { der, label: header?.[1] ?? "" };
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function derLengthBytes(length: number): Uint8Array {
  if (length < 0x80) return Uint8Array.of(length);
  const parts: number[] = [];
  let value = length;
  while (value > 0) {
    parts.unshift(value & 0xff);
    value = Math.floor(value / 256);
  }
  return Uint8Array.of(0x80 | parts.length, ...parts);
}

function derSequence(children: Uint8Array[]): Uint8Array {
  const content = concatBytes(children);
  return concatBytes([Uint8Array.of(0x30), derLengthBytes(content.length), content]);
}

function derOctetString(content: Uint8Array): Uint8Array {
  return concatBytes([Uint8Array.of(0x04), derLengthBytes(content.length), content]);
}

function derNull(): Uint8Array {
  return Uint8Array.of(0x05, 0x00);
}

function derRsaEncryptionOid(): Uint8Array {
  // 1.2.840.113549.1.1.1
  const parts: number[] = [1 * 40 + 2];
  for (const value of [840, 113549, 1, 1, 1]) {
    if (value < 128) {
      parts.push(value);
    } else {
      const encoded: number[] = [];
      let current = value;
      encoded.push(current & 0x7f);
      current = Math.floor(current / 128);
      while (current > 0) {
        encoded.unshift((current & 0x7f) | 0x80);
        current = Math.floor(current / 128);
      }
      parts.push(...encoded);
    }
  }
  return concatBytes([Uint8Array.of(0x06), derLengthBytes(parts.length), Uint8Array.from(parts)]);
}

function derIntegerZero(): Uint8Array {
  return Uint8Array.of(0x02, 0x01, 0x00);
}

// 商户密钥常为 PKCS#1（BEGIN RSA PRIVATE KEY），Web Crypto 只接受 PKCS#8，
// 这里把 PKCS#1 包一层 PKCS#8 外壳，避免要求用户手工转换。
function pkcs1ToPkcs8(pkcs1: Uint8Array): Uint8Array {
  const algorithmIdentifier = derSequence([derRsaEncryptionOid(), derNull()]);
  return derSequence([derIntegerZero(), algorithmIdentifier, derOctetString(pkcs1)]);
}

type DerNode = {
  tag: number;
  start: number;
  end: number;
  children: DerNode[] | null;
};

function readDerLength(bytes: Uint8Array, offset: number): { length: number; nextOffset: number } {
  const first = bytes[offset];
  if ((first & 0x80) === 0) return { length: first, nextOffset: offset + 1 };
  const count = first & 0x7f;
  let length = 0;
  for (let index = 0; index < count; index += 1) length = length * 256 + bytes[offset + 1 + index];
  return { length, nextOffset: offset + 1 + count };
}

function parseDer(bytes: Uint8Array, start: number, end: number): DerNode {
  const tag = bytes[start];
  const { length, nextOffset } = readDerLength(bytes, start + 1);
  const contentStart = nextOffset;
  const contentEnd = contentStart + length;
  const node: DerNode = { tag, start, end: contentEnd, children: null };
  if ((tag & 0x20) !== 0 && contentEnd <= end) {
    node.children = [];
    let cursor = contentStart;
    while (cursor < contentEnd) {
      const child = parseDer(bytes, cursor, contentEnd);
      node.children.push(child);
      cursor = child.end;
    }
  }
  return node;
}

export function base64Encode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function base64Decode(value: string): Uint8Array {
  const binary = atob(value.replace(/\s+/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const { der, label } = pemToDer(pem);
  const isPkcs1 = label.includes("RSA PRIVATE KEY");
  const keyDer = isPkcs1 ? pkcs1ToPkcs8(der) : der;
  return crypto.subtle.importKey("pkcs8", keyDer, RSA_ALGORITHM, false, ["sign"]);
}

export async function importPublicKey(pem: string): Promise<CryptoKey> {
  const { der, label } = pemToDer(pem);
  let spki = der;
  if (label.includes("CERTIFICATE")) {
    const certificate = parseDer(der, 0, der.length);
    const tbs = certificate.children?.[0];
    const children = tbs?.children ?? [];
    const versionPresent = children[0]?.tag === 0xa0;
    const subjectPublicKeyInfo = children[versionPresent ? 6 : 5];
    if (!subjectPublicKeyInfo) throw new Error("无法从证书中提取公钥");
    spki = der.slice(subjectPublicKeyInfo.start, subjectPublicKeyInfo.end);
  }
  return crypto.subtle.importKey("spki", spki, RSA_ALGORITHM, false, ["verify"]);
}

export async function signRsaSha256(key: CryptoKey, message: string): Promise<string> {
  const signature = await crypto.subtle.sign(RSA_ALGORITHM, key, textEncoder.encode(message));
  return base64Encode(new Uint8Array(signature));
}

export async function verifyRsaSha256(key: CryptoKey, message: string, signatureBase64: string): Promise<boolean> {
  try {
    return await crypto.subtle.verify(RSA_ALGORITHM, key, base64Decode(signatureBase64), textEncoder.encode(message));
  } catch {
    return false;
  }
}

export async function aesGcmDecrypt(input: {
  key: string;
  nonceBase64: string;
  ciphertextBase64: string;
  associatedData?: string;
}): Promise<string> {
  const key = await crypto.subtle.importKey("raw", textEncoder.encode(input.key), { name: "AES-GCM" }, false, ["decrypt"]);
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64Decode(input.nonceBase64),
      additionalData: input.associatedData ? textEncoder.encode(input.associatedData) : undefined,
    },
    key,
    base64Decode(input.ciphertextBase64),
  );
  return textDecoder.decode(plaintext);
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
