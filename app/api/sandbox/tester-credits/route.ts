import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "../../../../lib/auth";
import { getStore } from "../../../../lib/store";

const TESTER_CODE = "GC100-8A11-K7Q4";
const TESTER_CREDITS = 100;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { code?: string } | null;
  if (body?.code !== TESTER_CODE) {
    return NextResponse.json({ status: "error", message: "测试积分激活码无效" }, { status: 403 });
  }
  const store = await getStore();
  const user = await getSessionUser(request, store);
  if (!user) {
    return NextResponse.json({ status: "error", code: "AUTH_REQUIRED", message: "请先登录后再领取测试积分" }, { status: 401 });
  }
  const credited = await store.credit(user.id, TESTER_CREDITS, {
    kind: "tester_gift",
    referenceType: "user",
    referenceId: user.id,
    idempotencyKey: `tester:${user.id}`,
  });
  return NextResponse.json({ status: "success", credits: credited.balanceAfter, added: TESTER_CREDITS });
}
