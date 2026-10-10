import type { JobType } from "bullmq";

// A worker can keep sending heartbeats while consuming nothing (2026-10-10: Redis
// connection resets left it alive but idle, 14 jobs waited 8 hours and /api/health said
// healthy). The heartbeat proves the process is running, not that the queue is draining.
// A job normally starts within seconds, so "waiting, none active, oldest waiting for
// minutes" means the worker is not consuming.
export const STALL_AFTER_MS = 3 * 60_000;

export interface QueueStall {
  stalled: boolean;
  waiting: number;
  active: number;
  oldestWaitingAgeMs: number | null;
}

export function evaluateQueueStall(
  counts: { waiting?: number; active?: number },
  oldestWaitingAt: number | null,
  now: number = Date.now(),
  thresholdMs: number = STALL_AFTER_MS
): QueueStall {
  const waiting = counts.waiting ?? 0;
  const active = counts.active ?? 0;
  const oldestWaitingAgeMs = oldestWaitingAt === null ? null : Math.max(0, now - oldestWaitingAt);
  return {
    stalled: waiting > 0 && active === 0 && oldestWaitingAgeMs !== null && oldestWaitingAgeMs > thresholdMs,
    waiting,
    active,
    oldestWaitingAgeMs,
  };
}

interface StallQueue {
  getJobCounts(...types: JobType[]): Promise<Record<string, number>>;
  getJobs(types: JobType[], start: number, end: number, asc: boolean): Promise<Array<{ timestamp: number }>>;
}

export async function getQueueStall(queue: StallQueue): Promise<QueueStall> {
  const counts = await queue.getJobCounts("waiting", "active");
  const [oldest] = counts.waiting > 0 ? await queue.getJobs(["waiting"], 0, 0, true) : [];
  return evaluateQueueStall(counts, oldest?.timestamp ?? null);
}
