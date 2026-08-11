import { CREDIT_PACKAGES } from "./domain";

export type StoreUser = {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  status: string;
};

export type OrderRow = {
  id: string;
  userId: string;
  packageId: string;
  provider: string;
  amountFen: number;
  credits: number;
  status: string;
  providerTradeNo: string | null;
  idempotencyKey: string;
  paidAt: string | null;
};

export type CreditMeta = {
  kind: string;
  referenceType: string;
  referenceId: string;
  idempotencyKey: string;
};

export class StoreError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "StoreError";
    this.code = code;
  }
}

export interface AppStore {
  getUserByEmail(email: string): Promise<StoreUser | null>;
  getUserById(id: string): Promise<StoreUser | null>;
  createUser(input: { id: string; email: string; displayName: string; passwordHash: string }): Promise<StoreUser>;
  createSession(input: { tokenHash: string; userId: string; expiresAt: string }): Promise<void>;
  deleteSession(tokenHash: string): Promise<void>;
  getUserBySession(tokenHash: string): Promise<StoreUser | null>;
  ensureCreditAccount(userId: string): Promise<void>;
  getBalance(userId: string): Promise<number>;
  credit(userId: string, amount: number, meta: CreditMeta): Promise<{ applied: boolean; balanceAfter: number }>;
  debit(userId: string, amount: number, meta: CreditMeta): Promise<{ applied: boolean; balanceAfter: number }>;
  createOrder(input: {
    id: string;
    userId: string;
    packageId: string;
    provider: string;
    amountFen: number;
    credits: number;
    idempotencyKey: string;
  }): Promise<OrderRow>;
  getOrderById(id: string): Promise<OrderRow | null>;
  markOrderPaid(orderId: string, providerTradeNo: string, paidAt: string): Promise<OrderRow>;
  recordPaymentEvent(input: { id: string; provider: string; eventId: string; orderId: string; payloadHash: string }): Promise<{ applied: boolean }>;
  getCreditPackages(): Promise<Array<{ id: string; name: string; credits: number; priceFen: number }>>;
}

type D1DatabaseLike = {
  prepare(sql: string): {
    bind(...values: Array<string | number | null>): {
      first<T>(): Promise<T | null>;
      all<T>(): Promise<{ results: T[] }>;
      run(): Promise<{ meta: { changes: number; last_row_id?: number } }>;
    };
  };
};

export class D1Store implements AppStore {
  constructor(private db: D1DatabaseLike) {}

  private mapUser(row: any): StoreUser | null {
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      passwordHash: row.password_hash ?? "",
      status: row.status,
    };
  }

  private mapOrder(row: any): OrderRow | null {
    if (!row) return null;
    return {
      id: row.id,
      userId: row.user_id,
      packageId: row.package_id,
      provider: row.provider,
      amountFen: row.amount_fen,
      credits: row.credits,
      status: row.status,
      providerTradeNo: row.provider_trade_no ?? null,
      idempotencyKey: row.idempotency_key,
      paidAt: row.paid_at ?? null,
    };
  }

  async getUserByEmail(email: string) {
    const row = await this.db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first<any>();
    return this.mapUser(row);
  }

  async getUserById(id: string) {
    const row = await this.db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<any>();
    return this.mapUser(row);
  }

  async createUser(input: { id: string; email: string; displayName: string; passwordHash: string }) {
    await this.db
      .prepare("INSERT INTO users (id, email, display_name, password_hash, status) VALUES (?, ?, ?, ?, 'active')")
      .bind(input.id, input.email, input.displayName, input.passwordHash)
      .run();
    const created = await this.getUserById(input.id);
    if (!created) throw new StoreError("USER_CREATE_FAILED", "账号创建失败");
    return created;
  }

  async createSession(input: { tokenHash: string; userId: string; expiresAt: string }) {
    await this.db
      .prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
      .bind(input.tokenHash, input.userId, input.expiresAt)
      .run();
  }

  async deleteSession(tokenHash: string) {
    await this.db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
  }

  async getUserBySession(tokenHash: string) {
    const row = await this.db
      .prepare("SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?")
      .bind(tokenHash, new Date().toISOString())
      .first<any>();
    return this.mapUser(row);
  }

  async ensureCreditAccount(userId: string) {
    await this.db
      .prepare("INSERT OR IGNORE INTO credit_accounts (user_id, balance, version) VALUES (?, 0, 0)")
      .bind(userId)
      .run();
  }

  async getBalance(userId: string) {
    await this.ensureCreditAccount(userId);
    const row = await this.db.prepare("SELECT balance FROM credit_accounts WHERE user_id = ?").bind(userId).first<{ balance: number }>();
    return row?.balance ?? 0;
  }

  async credit(userId: string, amount: number, meta: CreditMeta) {
    await this.ensureCreditAccount(userId);
    const inserted = await this.db
      .prepare(`INSERT INTO credit_ledger (id, user_id, kind, amount, balance_after, reference_type, reference_id, idempotency_key)
        SELECT ?, ?, ?, ?, (SELECT balance FROM credit_accounts WHERE user_id = ?) + ?, ?, ?, ?
        WHERE NOT EXISTS (SELECT 1 FROM credit_ledger WHERE user_id = ? AND idempotency_key = ?)
        RETURNING id, balance_after`)
      .bind(crypto.randomUUID(), userId, meta.kind, amount, userId, amount, meta.referenceType, meta.referenceId, meta.idempotencyKey, userId, meta.idempotencyKey)
      .first<{ balance_after: number }>();
    if (inserted) {
      const balanceAfter = Number(inserted.balance_after);
      await this.db
        .prepare("UPDATE credit_accounts SET balance = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?")
        .bind(balanceAfter, userId)
        .run();
      return { applied: true, balanceAfter };
    }
    const existing = await this.db
      .prepare("SELECT balance_after FROM credit_ledger WHERE user_id = ? AND idempotency_key = ?")
      .bind(userId, meta.idempotencyKey)
      .first<{ balance_after: number }>();
    return { applied: false, balanceAfter: existing ? Number(existing.balance_after) : 0 };
  }

  async debit(userId: string, amount: number, meta: CreditMeta) {
    await this.ensureCreditAccount(userId);
    const inserted = await this.db
      .prepare(`INSERT INTO credit_ledger (id, user_id, kind, amount, balance_after, reference_type, reference_id, idempotency_key)
        SELECT ?, ?, ?, ?, (SELECT balance FROM credit_accounts WHERE user_id = ?) - ?, ?, ?, ?
        WHERE NOT EXISTS (SELECT 1 FROM credit_ledger WHERE user_id = ? AND idempotency_key = ?)
          AND (SELECT balance FROM credit_accounts WHERE user_id = ?) >= ?
        RETURNING id, balance_after`)
      .bind(
        crypto.randomUUID(), userId, meta.kind, amount, userId, amount, meta.referenceType, meta.referenceId, meta.idempotencyKey,
        userId, meta.idempotencyKey, userId, amount,
      )
      .first<{ balance_after: number }>();
    if (inserted) {
      const balanceAfter = Number(inserted.balance_after);
      await this.db
        .prepare("UPDATE credit_accounts SET balance = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?")
        .bind(balanceAfter, userId)
        .run();
      return { applied: true, balanceAfter };
    }
    const existing = await this.db
      .prepare("SELECT balance_after FROM credit_ledger WHERE user_id = ? AND idempotency_key = ?")
      .bind(userId, meta.idempotencyKey)
      .first<{ balance_after: number }>();
    if (existing) return { applied: false, balanceAfter: Number(existing.balance_after) };
    throw new StoreError("INSUFFICIENT_CREDITS", "当前积分不足，请先充值");
  }

  async createOrder(input: {
    id: string;
    userId: string;
    packageId: string;
    provider: string;
    amountFen: number;
    credits: number;
    idempotencyKey: string;
  }) {
    await this.db
      .prepare(`INSERT INTO orders (id, user_id, package_id, provider, amount_fen, credits, status, idempotency_key)
        SELECT ?, ?, ?, ?, ?, ?, 'pending', ?
        WHERE NOT EXISTS (SELECT 1 FROM orders WHERE user_id = ? AND idempotency_key = ?)`)
      .bind(input.id, input.userId, input.packageId, input.provider, input.amountFen, input.credits, input.idempotencyKey, input.userId, input.idempotencyKey)
      .run();
    const row = await this.db
      .prepare("SELECT * FROM orders WHERE user_id = ? AND idempotency_key = ?")
      .bind(input.userId, input.idempotencyKey)
      .first<any>();
    const order = this.mapOrder(row);
    if (!order) throw new StoreError("ORDER_CREATE_FAILED", "订单创建失败");
    return order;
  }

  async getOrderById(id: string) {
    const row = await this.db.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first<any>();
    return this.mapOrder(row);
  }

  async markOrderPaid(orderId: string, providerTradeNo: string, paidAt: string) {
    await this.db
      .prepare("UPDATE orders SET status = 'paid', provider_trade_no = ?, paid_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'")
      .bind(providerTradeNo, paidAt, orderId)
      .run();
    const order = await this.getOrderById(orderId);
    if (!order) throw new StoreError("ORDER_NOT_FOUND", "订单不存在");
    return order;
  }

  async recordPaymentEvent(input: { id: string; provider: string; eventId: string; orderId: string; payloadHash: string }) {
    const result = await this.db
      .prepare("INSERT OR IGNORE INTO payment_events (id, provider, event_id, order_id, verified, payload_hash) VALUES (?, ?, ?, ?, 1, ?)")
      .bind(input.id, input.provider, input.eventId, input.orderId, input.payloadHash)
      .run();
    return { applied: result.meta.changes === 1 };
  }

  async getCreditPackages() {
    const result = await this.db
      .prepare("SELECT id, name, credits, price_fen FROM credit_packages WHERE active = 1 ORDER BY sort_order ASC")
      .all<{ id: string; name: string; credits: number; price_fen: number }>();
    if (result.results.length) {
      return result.results.map((item) => ({ id: item.id, name: item.name, credits: item.credits, priceFen: item.price_fen }));
    }
    return CREDIT_PACKAGES.map((item) => ({ id: item.id, name: item.name, credits: item.credits, priceFen: item.priceFen }));
  }
}

type MemorySession = { tokenHash: string; userId: string; expiresAt: string };
type MemoryLedger = { balanceAfter: number; userId: string };
type MemoryOrder = OrderRow;

export class MemoryStore implements AppStore {
  private users = new Map<string, StoreUser>();
  private usersByEmail = new Map<string, StoreUser>();
  private sessions = new Map<string, MemorySession>();
  private accounts = new Map<string, { balance: number; version: number }>();
  private ledger = new Map<string, MemoryLedger>();
  private orders = new Map<string, MemoryOrder>();
  private ordersByIdempotency = new Map<string, MemoryOrder>();
  private paymentEvents = new Map<string, { applied: boolean }>();

  private key(userId: string, idempotencyKey: string) {
    return `${userId}:${idempotencyKey}`;
  }

  async getUserByEmail(email: string) {
    return this.usersByEmail.get(email.toLowerCase()) ?? null;
  }

  async getUserById(id: string) {
    return this.users.get(id) ?? null;
  }

  async createUser(input: { id: string; email: string; displayName: string; passwordHash: string }) {
    const user: StoreUser = { id: input.id, email: input.email, displayName: input.displayName, passwordHash: input.passwordHash, status: "active" };
    this.users.set(user.id, user);
    this.usersByEmail.set(user.email.toLowerCase(), user);
    return user;
  }

  async createSession(input: { tokenHash: string; userId: string; expiresAt: string }) {
    this.sessions.set(input.tokenHash, input);
  }

  async deleteSession(tokenHash: string) {
    this.sessions.delete(tokenHash);
  }

  async getUserBySession(tokenHash: string) {
    const session = this.sessions.get(tokenHash);
    if (!session || session.expiresAt <= new Date().toISOString()) return null;
    return this.users.get(session.userId) ?? null;
  }

  async ensureCreditAccount(userId: string) {
    if (!this.accounts.has(userId)) this.accounts.set(userId, { balance: 0, version: 0 });
  }

  async getBalance(userId: string) {
    await this.ensureCreditAccount(userId);
    return this.accounts.get(userId)!.balance;
  }

  async credit(userId: string, amount: number, meta: CreditMeta) {
    await this.ensureCreditAccount(userId);
    const idem = this.key(userId, meta.idempotencyKey);
    const existing = this.ledger.get(idem);
    if (existing) return { applied: false, balanceAfter: existing.balanceAfter };
    const account = this.accounts.get(userId)!;
    const balanceAfter = account.balance + amount;
    account.balance = balanceAfter;
    account.version += 1;
    this.ledger.set(idem, { balanceAfter, userId });
    return { applied: true, balanceAfter };
  }

  async debit(userId: string, amount: number, meta: CreditMeta) {
    await this.ensureCreditAccount(userId);
    const idem = this.key(userId, meta.idempotencyKey);
    const existing = this.ledger.get(idem);
    if (existing) return { applied: false, balanceAfter: existing.balanceAfter };
    const account = this.accounts.get(userId)!;
    if (account.balance < amount) throw new StoreError("INSUFFICIENT_CREDITS", "当前积分不足，请先充值");
    const balanceAfter = account.balance - amount;
    account.balance = balanceAfter;
    account.version += 1;
    this.ledger.set(idem, { balanceAfter, userId });
    return { applied: true, balanceAfter };
  }

  async createOrder(input: {
    id: string;
    userId: string;
    packageId: string;
    provider: string;
    amountFen: number;
    credits: number;
    idempotencyKey: string;
  }) {
    const idem = this.key(input.userId, input.idempotencyKey);
    const existing = this.ordersByIdempotency.get(idem);
    if (existing) return existing;
    const order: MemoryOrder = {
      id: input.id,
      userId: input.userId,
      packageId: input.packageId,
      provider: input.provider,
      amountFen: input.amountFen,
      credits: input.credits,
      status: "pending",
      providerTradeNo: null,
      idempotencyKey: input.idempotencyKey,
      paidAt: null,
    };
    this.orders.set(order.id, order);
    this.ordersByIdempotency.set(idem, order);
    return order;
  }

  async getOrderById(id: string) {
    return this.orders.get(id) ?? null;
  }

  async markOrderPaid(orderId: string, providerTradeNo: string, paidAt: string) {
    const order = this.orders.get(orderId);
    if (!order) throw new StoreError("ORDER_NOT_FOUND", "订单不存在");
    if (order.status !== "paid") {
      order.status = "paid";
      order.providerTradeNo = providerTradeNo;
      order.paidAt = paidAt;
    }
    return order;
  }

  async recordPaymentEvent(input: { id: string; provider: string; eventId: string; orderId: string; payloadHash: string }) {
    const key = `${input.provider}:${input.eventId}`;
    if (this.paymentEvents.has(key)) return { applied: false };
    this.paymentEvents.set(key, { applied: true });
    return { applied: true };
  }

  async getCreditPackages() {
    return CREDIT_PACKAGES.map((item) => ({ id: item.id, name: item.name, credits: item.credits, priceFen: item.priceFen }));
  }
}

type CloudflareWorkerEnv = { DB?: D1DatabaseLike };

let cachedStore: Promise<AppStore> | null = null;

export function getStore(): Promise<AppStore> {
  if (!cachedStore) {
    cachedStore = (async () => {
      try {
        const mod = (await import("cloudflare:workers")) as { env?: CloudflareWorkerEnv };
        if (mod.env?.DB) return new D1Store(mod.env.DB);
      } catch {
        // Plain Node test environment: fall back to an in-memory store.
      }
      return new MemoryStore();
    })();
  }
  return cachedStore;
}
