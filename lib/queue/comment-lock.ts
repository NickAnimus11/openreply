import { randomUUID } from "node:crypto";

// One comment can be enqueued many times (webhook plus every polling sweep), and the
// worker runs several jobs at once. Without a lock, parallel jobs for the same comment
// all read "no public reply sent yet" and each posts one, so a commenter can get five
// public replies and several DMs. The lock serialises them; a job that finds it held
// skips, because the holder is already doing the work and later jobs hit the
// publicReplySentAt / SENT guards.
//
// The TTL only matters if a worker dies mid-job: the lock then frees itself, and the
// next polling sweep re-enqueues the comment.
const LOCK_TTL_MS = 120_000;

const RELEASE_IF_OURS = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;

export interface LockRedis {
  set(key: string, value: string, px: "PX", ms: number, nx: "NX"): Promise<"OK" | null>;
  eval(script: string, numKeys: number, ...args: string[]): Promise<unknown>;
}

/** Runs `fn` if no other job holds the comment's lock. Returns false (without running) when it is held. */
export async function withCommentLock(
  redis: LockRedis,
  commentKey: string,
  fn: () => Promise<void>
): Promise<boolean> {
  const key = `lock:comment:${commentKey}`;
  const token = randomUUID();

  if ((await redis.set(key, token, "PX", LOCK_TTL_MS, "NX")) !== "OK") return false;

  try {
    await fn();
    return true;
  } finally {
    // Compare-and-delete: if the TTL expired and someone else took the lock, leave theirs alone.
    await redis.eval(RELEASE_IF_OURS, 1, key, token).catch(() => undefined);
  }
}
