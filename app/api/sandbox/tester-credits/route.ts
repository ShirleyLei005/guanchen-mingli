import { NextRequest, NextResponse } from "next/server";
import { setCreditCookie } from "../../../../lib/credits";

const TESTER_CODE = "GC100-8A11-K7Q4";

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("code") !== TESTER_CODE) {
    return NextResponse.json({ status: "error", message: "测试积分激活码无效" }, { status: 403 });
  }
  const response = NextResponse.redirect(new URL("/?tester=ready", request.url));
  setCreditCookie(response, 100);
  return response;
}
