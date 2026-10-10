import { describe, expect, it } from "vitest";
import { STALL_AFTER_MS, evaluateQueueStall } from "@/lib/ops/queue-stall";

const now = 1_000_000_000;

describe("evaluateQueueStall", () => {
  it("flags jobs that have waited past the threshold with nothing active", () => {
    const r = evaluateQueueStall({ waiting: 14, active: 0 }, now - STALL_AFTER_MS - 1, now);
    expect(r.stalled).toBe(true);
    expect(r.waiting).toBe(14);
  });

  it("is not stalled when the wait is short (a job is about to be picked up)", () => {
    expect(evaluateQueueStall({ waiting: 3, active: 0 }, now - 5_000, now).stalled).toBe(false);
  });

  it("is not stalled while something is being processed, however long others wait", () => {
    expect(evaluateQueueStall({ waiting: 30, active: 2 }, now - 3_600_000, now).stalled).toBe(false);
  });

  it("is not stalled when nothing is waiting", () => {
    expect(evaluateQueueStall({ waiting: 0, active: 0 }, null, now).stalled).toBe(false);
  });
});
