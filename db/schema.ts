import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
};

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull().default("观辰用户"),
  status: text("status").notNull().default("active"),
  ...timestamps,
}, (table) => [uniqueIndex("users_email_idx").on(table.email)]);

export const birthProfiles = sqliteTable("birth_profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  alias: text("alias").notNull(),
  gender: text("gender").notNull(),
  calendarType: text("calendar_type").notNull().default("solar"),
  birthDateTime: text("birth_datetime").notNull(),
  placeName: text("place_name").notNull(),
  latitude: text("latitude"),
  longitude: text("longitude"),
  timezone: text("timezone").notNull().default("Asia/Shanghai"),
  timePrecision: text("time_precision").notNull().default("minute"),
  trueSolarTime: integer("true_solar_time", { mode: "boolean" }).notNull().default(false),
  deletedAt: text("deleted_at"),
  ...timestamps,
});

export const charts = sqliteTable("charts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  birthProfileId: text("birth_profile_id").notNull().references(() => birthProfiles.id),
  type: text("type").notNull(),
  algorithmVersion: text("algorithm_version").notNull(),
  inputSnapshot: text("input_snapshot", { mode: "json" }).notNull(),
  result: text("result", { mode: "json" }).notNull(),
  resultHash: text("result_hash").notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("chart_hash_idx").on(table.userId, table.resultHash)]);

export const reports = sqliteTable("reports", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  chartId: text("chart_id").notNull().references(() => charts.id),
  topic: text("topic").notNull(),
  status: text("status").notNull().default("queued"),
  content: text("content", { mode: "json" }),
  evidence: text("evidence", { mode: "json" }),
  promptVersion: text("prompt_version").notNull().default("report-v1"),
  idempotencyKey: text("idempotency_key").notNull(),
  errorCode: text("error_code"),
  ...timestamps,
}, (table) => [uniqueIndex("reports_idempotency_idx").on(table.userId, table.idempotencyKey)]);

export const compatibilityReports = sqliteTable("compatibility_reports", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  primaryChartId: text("primary_chart_id").notNull().references(() => charts.id),
  partnerChartId: text("partner_chart_id").notNull().references(() => charts.id),
  consentConfirmed: integer("consent_confirmed", { mode: "boolean" }).notNull(),
  result: text("result", { mode: "json" }),
  status: text("status").notNull().default("queued"),
  ...timestamps,
});

export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  chartId: text("chart_id").notNull().references(() => charts.id),
  title: text("title").notNull(),
  status: text("status").notNull().default("active"),
  ...timestamps,
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull().references(() => conversations.id),
  role: text("role").notNull(),
  content: text("content").notNull(),
  safetyCategory: text("safety_category"),
  tokenUsage: integer("token_usage").notNull().default(0),
  idempotencyKey: text("idempotency_key"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const creditAccounts = sqliteTable("credit_accounts", {
  userId: text("user_id").primaryKey().references(() => users.id),
  balance: integer("balance").notNull().default(5),
  version: integer("version").notNull().default(0),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const creditLedger = sqliteTable("credit_ledger", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  kind: text("kind").notNull(),
  amount: integer("amount").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  referenceType: text("reference_type").notNull(),
  referenceId: text("reference_id").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("ledger_idempotency_idx").on(table.userId, table.idempotencyKey)]);

export const creditPackages = sqliteTable("credit_packages", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  credits: integer("credits").notNull(),
  priceFen: integer("price_fen").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps,
});

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  packageId: text("package_id").notNull().references(() => creditPackages.id),
  provider: text("provider").notNull().default("sandbox"),
  amountFen: integer("amount_fen").notNull(),
  credits: integer("credits").notNull(),
  status: text("status").notNull().default("pending"),
  providerTradeNo: text("provider_trade_no"),
  idempotencyKey: text("idempotency_key").notNull(),
  paidAt: text("paid_at"),
  ...timestamps,
}, (table) => [uniqueIndex("orders_idempotency_idx").on(table.userId, table.idempotencyKey)]);

export const paymentEvents = sqliteTable("payment_events", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  eventId: text("event_id").notNull(),
  orderId: text("order_id").references(() => orders.id),
  verified: integer("verified", { mode: "boolean" }).notNull().default(false),
  payloadHash: text("payload_hash").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("payment_event_idx").on(table.provider, table.eventId)]);

export const analysisJobs = sqliteTable("analysis_jobs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id").notNull(),
  status: text("status").notNull().default("queued"),
  progress: integer("progress").notNull().default(0),
  attempts: integer("attempts").notNull().default(0),
  errorCode: text("error_code"),
  refunded: integer("refunded", { mode: "boolean" }).notNull().default(false),
  ...timestamps,
});
