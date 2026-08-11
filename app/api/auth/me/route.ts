import { NextRequest, NextResponse } from "next/server";
import { getCredits } from "../../../../lib/credits";

export async function GET(request: NextRequest) {
  const state = await getCredits(request);
  if (!state.authenticated || !state.user) {
    return NextResponse.json({ authenticated: false, email: null, displayName: null, credits: 0 });
  }
  return NextResponse.json({ authenticated: true, email: state.user.email, displayName: state.user.displayName, credits: state.credits });
}
