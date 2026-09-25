export type DailyBankCandidate = {
  id: string;
  topico: string | null;
  useCount: number;
  lastUsedAt: Date | null;
  createdAt: Date;
};

export type DailySelectionOptions = {
  total?: number;
  newLimit?: number;
  reuseGapDays?: number;
  now?: Date;
};

function timestamp(value: Date | null): number {
  return value ? value.getTime() : Number.NEGATIVE_INFINITY;
}

function spreadByTopic<T extends DailyBankCandidate>(items: T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = item.topico?.trim() || "__sem_topico__";
    const group = groups.get(key) || [];
    group.push(item);
    groups.set(key, group);
  }

  const result: T[] = [];
  const orderedGroups = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  let index = 0;
  while (result.length < items.length) {
    for (const [, group] of orderedGroups) {
      if (group[index]) result.push(group[index]);
    }
    index += 1;
  }
  return result;
}

export function selectDailyBankItems<T extends DailyBankCandidate>(
  candidates: T[],
  options: DailySelectionOptions = {},
): T[] {
  const total = options.total ?? 25;
  const newLimit = options.newLimit ?? 5;
  const reuseGapDays = options.reuseGapDays ?? 7;
  const now = options.now ?? new Date();
  const cutoff = now.getTime() - reuseGapDays * 86_400_000;

  const selected: T[] = [];
  const selectedIds = new Set<string>();
  const add = (items: T[], limit: number) => {
    for (const item of items) {
      if (selected.length >= limit || selectedIds.has(item.id)) continue;
      selected.push(item);
      selectedIds.add(item.id);
    }
  };

  const unused = candidates
    .filter((item) => item.useCount === 0)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
  add(spreadByTopic(unused).slice(0, newLimit), total);

  const outsideWindow = candidates
    .filter((item) => item.useCount > 0 && timestamp(item.lastUsedAt) <= cutoff)
    .sort((a, b) => timestamp(a.lastUsedAt) - timestamp(b.lastUsedAt) || a.id.localeCompare(b.id));
  add(spreadByTopic(outsideWindow), total);

  // Banco inicial pequeno ou janela ainda não madura: completa pelo menos recente,
  // preservando disponibilidade sem ultrapassar o limite de inéditas.
  const lruFallback = candidates
    .filter((item) => item.useCount > 0)
    .sort((a, b) => timestamp(a.lastUsedAt) - timestamp(b.lastUsedAt) || a.id.localeCompare(b.id));
  add(spreadByTopic(lruFallback), total);

  return selected;
}
