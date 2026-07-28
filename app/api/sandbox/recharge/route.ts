import { NextRequest, NextResponse } from "next/server";
import { CREDIT_PACKAGES } from "../../../../lib/domain";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { packageId?: string; idempotencyKey?: string } | null;
  if (!body?.idempotencyKey) {
    return NextResponse.json({ error: "IDEMPOTENCY_KEY_REQUIRED" }, { status: 400 });
  }
  const pack = CREDIT_PACKAGES.find((item) => item.id === body.packageId);
  if (!pack) return NextResponse.json({ error: "PACKAGE_NOT_FOUND" }, { status: 404 });

  return NextResponse.json({
    mode: "sandbox",
    orderId: crypto.randomUUID(),
    idempotencyKey: body.idempotencyKey,
    package: pack,
    status: "paid",
  });
}
