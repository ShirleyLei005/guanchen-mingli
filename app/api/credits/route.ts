import { NextRequest, NextResponse } from "next/server";
import { getCredits } from "../../../lib/credits";
import { NEW_USER_GIFT } from "../../../lib/auth";

export async function GET(request: NextRequest) {
  const state = await getCredits(request);
  return NextResponse.json({
    authenticated: state.authenticated,
    credits: state.credits,
    displayName: state.user?.displayName ?? null,
    email: state.user?.email ?? null,
    newUserGift: NEW_USER_GIFT,
    message: state.authenticated ? undefined : "注册并验证邮箱后，新用户可免费获得 5 积分，用于解锁八字或紫微斗数完整报告。",
  });
}
