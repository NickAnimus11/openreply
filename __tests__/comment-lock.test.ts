import { describe, expect, it } from "vitest";
import { withCommentLock, type LockRedis } from "@/lib/queue/comment-lock";

// Minimal in-memory stand-in for the two Redis calls the lock uses.
function fakeRedis(): LockRedis & { keys: Map<string, string> } {
  const keys = new Map<string, string>();
  return {
    keys,
    async set(key, value, _px, _ms, _nx) {
      if (keys.has(key)) return null;
      keys.set(key, value);
      return "OK";
    },
    async eval(_script, _n, key, token) {
      if (keys.get(key) === token) return keys.delete(key) ? 1 : 0;
      return 0;
    },
  };
}

describe("withCommentLock", () => {
  it("lets exactly one of several parallel jobs for the same comment run", async () => {
    const redis = fakeRedis();
    let ran = 0;
    const job = () =>
      withCommentLock(redis, "acct:comment1", async () => {
        ran++;
        await new Promise((r) => setTimeout(r, 20));
      });

    const results = await Promise.all([job(), job(), job(), job(), job()]);

    expect(ran).toBe(1);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("does not block different comments", async () => {
    const redis = fakeRedis();
    const results = await Promise.all(
      ["a", "b", "c"].map((id) => withCommentLock(redis, id, async () => undefined))
    );
    expect(results).toEqual([true, true, true]);
  });

  it("releases the lock afterwards, including when the job throws", async () => {
    const redis = fakeRedis();
    await expect(
      withCommentLock(redis, "x", async () => {
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");
    expect(redis.keys.size).toBe(0);
    expect(await withCommentLock(redis, "x", async () => undefined)).toBe(true);
  });
});
