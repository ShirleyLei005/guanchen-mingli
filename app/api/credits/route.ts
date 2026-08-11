import { NextRequest, NextResponse } from "next/server";
import { NEW_USER_CREDITS, readCredits, setCreditCookie } from "../../../lib/credits";

export async function GET(request: NextRequest) {
  const credits = readCredits(request);
  const response = NextResponse.json({ credits, newUserGift: NEW_USER_CREDITS });
  if (!request.cookies.get("guanchen_credits")) setCreditCookie(response, credits);
  return response;
}
