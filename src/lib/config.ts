import { prisma } from "./db";

export type Settings = {
  maxDurationMin: number;
  queueLimit: number;
  perUserLimit: number;
  autoCleanup: boolean;
};

// Config lives in a single Setting row (id=1), created on first read.
export async function getSettings(): Promise<Settings> {
  const row = await prisma.setting.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  });
  return {
    maxDurationMin: row.maxDurationMin,
    queueLimit: row.queueLimit,
    perUserLimit: row.perUserLimit,
    autoCleanup: row.autoCleanup,
  };
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
  const data: Partial<Settings> = {};
  if (patch.maxDurationMin != null) data.maxDurationMin = clamp(patch.maxDurationMin, 1, 30);
  if (patch.perUserLimit != null) data.perUserLimit = clamp(patch.perUserLimit, 1, 10);
  if (patch.queueLimit != null) data.queueLimit = clamp(patch.queueLimit, 1, 200);
  if (patch.autoCleanup != null) data.autoCleanup = patch.autoCleanup;
  const row = await prisma.setting.upsert({
    where: { id: 1 },
    create: { id: 1, ...data },
    update: data,
  });
  return {
    maxDurationMin: row.maxDurationMin,
    queueLimit: row.queueLimit,
    perUserLimit: row.perUserLimit,
    autoCleanup: row.autoCleanup,
  };
}
