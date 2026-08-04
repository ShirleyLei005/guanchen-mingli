import assert from "node:assert/strict";
import test from "node:test";

test("commercial constants are wired into the source", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) =>
    readFile(new URL("../lib/domain.ts", import.meta.url), "utf8")
  );
  assert.match(source, /bazi_report:\s*5/);
  assert.match(source, /ziwei_report:\s*5/);
  assert.match(source, /compatibility:\s*10/);
  assert.match(source, /conversation_message:\s*3/);
  assert.match(source, /priceFen:\s*990/);
  assert.match(source, /priceFen:\s*3900/);
  assert.match(source, /priceFen:\s*7900/);
});

test("migration contains idempotency and immutable ledger structures", async () => {
  const migration = await import("node:fs/promises").then(({ readFile }) =>
    readFile(new URL("../drizzle/0001_commercial_core.sql", import.meta.url), "utf8")
  );
  assert.match(migration, /ledger_idempotency_idx/);
  assert.match(migration, /orders_idempotency_idx/);
  assert.match(migration, /payment_event_idx/);
});
