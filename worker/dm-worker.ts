import { createDMWorker } from "@/lib/queue/dm-worker";
import { recordWorkerHeartbeat } from "@/lib/ops/worker-health";
import { reconcileComments } from "@/lib/polling/comment-reconciler";
import { attachPendingNextReels } from "@/lib/automation/attach-next-reel";
import { getDMQueue } from "@/lib/queue/client";
import { getQueueStall } from "@/lib/ops/queue-stall";
import { prisma } from "@/lib/db/client";
import os from "node:os";

const worker = createDMWorker();
const startedAt = new Date().toISOString();
const HEARTBEAT_INTERVAL_MS = 30_000;
// Polling safety net for comments that webhooks miss. Runs in the worker because
// it must fire every few minutes and Vercel's free crons only run once a day.
// Each sweep queries Postgres. Neon scales to zero only after 5 idle minutes, so a
// 5-minute sweep kept the free-plan compute awake 24/7 and used up the monthly
// allowance (2026-10). 30 minutes lets it sleep between sweeps; webhooks still
// deliver normal comments instantly, this only delays the ones Meta drops.
const POLL_INTERVAL_MS = Number(
  process.env.COMMENT_POLL_INTERVAL_MS ?? 30 * 60_000
);

console.log("[DM Worker] Started");

async function heartbeat() {
  try {
    await recordWorkerHeartbeat({
      pid: process.pid,
      hostname: os.hostname(),
      startedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[DM Worker] Heartbeat failed:", message);
  }
}

void heartbeat();
const heartbeatTimer = setInterval(() => void heartbeat(), HEARTBEAT_INTERVAL_MS);

// The heartbeat above keeps running even when this process has stopped consuming jobs
// (Redis connection resets, 2026-10-10). If work has been waiting for minutes with
// nothing active, exit: launchd / Docker / systemd restarts the worker. Not within the
// first minute of life, so a worker that cannot consume restarts about once a minute,
// not in a tight loop.
async function exitIfStalled() {
  if (process.uptime() < 60) return;
  const stall = await getQueueStall(getDMQueue());
  if (!stall.stalled) return;
  const message = `Queue stalled (${stall.waiting} waiting, none active, oldest ${Math.round(
    (stall.oldestWaitingAgeMs ?? 0) / 1000
  )}s): exiting so the supervisor restarts the worker`;
  console.error("[DM Worker]", message);
  await prisma.operationalEvent
    .create({ data: { source: "WORKER", level: "ERROR", message } })
    .catch(() => undefined);
  process.exit(1);
}

async function poll() {
  try {
    const attached = await attachPendingNextReels();
    if (attached.bound > 0 || attached.failedAccounts > 0) {
      console.log("[DM Worker] Next-reel attachment:", attached);
    }
    await reconcileComments();
    await exitIfStalled();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[DM Worker] Comment reconciliation failed:", message);
  }
}

// Kick off one sweep shortly after boot, then on a fixed interval.
setTimeout(() => void poll(), 10_000);
const pollTimer = setInterval(() => void poll(), POLL_INTERVAL_MS);

async function shutdown(signal: string) {
  console.log(`[DM Worker] ${signal} received, closing worker`);
  clearInterval(heartbeatTimer);
  clearInterval(pollTimer);
  await worker.close();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
