import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, sha256Hex } from "./auth";
import { getStore, StoreError, type StoreUser } from "./store";

export const NEW_USER_CREDITS = 5;

export type CreditState = {
  authenticated: boolean;
  credits: number;
  user?: StoreUser;
};

export async function getCredits(request: NextRequest): Promise<CreditState> {
  const store = await getStore();
  const user = await getSessionUser(request, store);
  if (!user) return { authenticated: false, credits: 0 };
  return { authenticated: true, credits: await store.getBalance(user.id), user };
}

export async function resolvePaidAccess(request: NextRequest) {
  const store = await getStore();
  const user = await getSessionUser(request, store);
  if (!user) {
    return {
      error: NextResponse.json(
        {
          status: "error",
          code: "AUTH_REQUIRED",
          message: "请先登录。登录后新用户可免费获得 5 积分，用于解锁八字或紫微斗数完整报告。",
        },
        { status: 401 },
      ),
    };
  }
  return { user, credits: await store.getBalance(user.id), store };
}

export function insufficientCredits(credits: number, cost: number) {
  return NextResponse.json(
    {
      status: "error",
      code: "INSUFFICIENT_CREDITS",
      message: `当前积分不足，本次需要 ${cost} 积分`,
      credits,
      requiredCredits: cost,
    },
    { status: 402 },
  );
}

export function storeErrorResponse(error: unknown, fallbackCode = "STORE_ERROR") {
  if (error instanceof StoreError && error.code === "INSUFFICIENT_CREDITS") {
    return NextResponse.json(
      { status: "error", code: "INSUFFICIENT_CREDITS", message: error.message, requiredCredits: 1 },
      { status: 402 },
    );
  }
  return NextResponse.json(
    { status: "error", code: fallbackCode, message: error instanceof Error ? error.message : "账户服务暂时不可用" },
    { status: 500 },
  );
}

export async function purchaseIdempotencyKey(scope: string, payload: unknown) {
  const hash = await sha256Hex(JSON.stringify(payload ?? {}));
  return `${scope}:${hash}`;
}
