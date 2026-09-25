import assert from "node:assert/strict";
import test from "node:test";
import { selectDailyBankItems, type DailyBankCandidate } from "../src/lib/dailyQuestionSelection";

const now = new Date("2026-09-24T12:00:00.000Z");

function candidate(id: string, overrides: Partial<DailyBankCandidate> = {}): DailyBankCandidate {
  return {
    id,
    topico: null,
    useCount: 1,
    lastUsedAt: new Date("2026-09-01T12:00:00.000Z"),
    createdAt: new Date("2026-08-01T12:00:00.000Z"),
    ...overrides,
  };
}

test("limita questões inéditas a cinco", () => {
  const unused = Array.from({ length: 12 }, (_, index) => candidate(`new-${index}`, {
    useCount: 0,
    lastUsedAt: null,
    createdAt: new Date(`2026-09-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`),
  }));
  const reused = Array.from({ length: 30 }, (_, index) => candidate(`old-${index}`));
  const selected = selectDailyBankItems([...unused, ...reused], { now });

  assert.equal(selected.length, 25);
  assert.equal(selected.filter((item) => item.useCount === 0).length, 5);
});

test("prioriza itens fora da janela de sete dias", () => {
  const eligible = candidate("eligible", { lastUsedAt: new Date("2026-09-17T11:59:59.000Z") });
  const tooRecent = candidate("recent", { lastUsedAt: new Date("2026-09-20T12:00:00.000Z") });
  const selected = selectDailyBankItems([tooRecent, eligible], { now, total: 1, newLimit: 0 });

  assert.equal(selected[0]?.id, "eligible");
});

test("usa LRU quando o banco ainda não cobre a janela", () => {
  const oldest = candidate("oldest", { lastUsedAt: new Date("2026-09-22T12:00:00.000Z") });
  const newest = candidate("newest", { lastUsedAt: new Date("2026-09-23T12:00:00.000Z") });
  const selected = selectDailyBankItems([newest, oldest], { now, total: 2, newLimit: 0 });

  assert.deepEqual(selected.map((item) => item.id), ["oldest", "newest"]);
});

test("intercala tópicos quando possível", () => {
  const items = [
    candidate("a1", { topico: "A" }),
    candidate("a2", { topico: "A" }),
    candidate("b1", { topico: "B" }),
    candidate("b2", { topico: "B" }),
  ];
  const selected = selectDailyBankItems(items, { now, total: 4, newLimit: 0 });

  assert.deepEqual(selected.map((item) => item.topico), ["A", "B", "A", "B"]);
});
