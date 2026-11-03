import { describe, expect, it } from "vitest";
import { isNonHumanAgent, CLICK_DEDUPE_WINDOW_MS } from "@/lib/tracking/click-filter";

describe("isNonHumanAgent", () => {
  it("rejects the tooling that actually polluted the data", () => {
    // the four rows deleted on 2026-11-02 came from this exact agent
    expect(isNonHumanAgent("curl/8.7.1")).toBe(true);
    expect(isNonHumanAgent("Wget/1.21")).toBe(true);
    expect(isNonHumanAgent("python-requests/2.31.0")).toBe(true);
  });

  it("rejects link unfurlers, which fetch on a recipient's behalf", () => {
    expect(isNonHumanAgent("facebookexternalhit/1.1")).toBe(true);
    expect(isNonHumanAgent("WhatsApp/2.23")).toBe(true);
    expect(isNonHumanAgent("Mozilla/5.0 (compatible; TelegramBot/1.0)")).toBe(true);
  });

  it("rejects a missing or blank agent — every real browser sends one", () => {
    expect(isNonHumanAgent(null)).toBe(true);
    expect(isNonHumanAgent("")).toBe(true);
    expect(isNonHumanAgent("   ")).toBe(true);
  });

  it("accepts the real click from the 2026-11-02 end-to-end test", () => {
    expect(
      isNonHumanAgent("Mozilla/5.0 (Linux; Android 14; 22101320G Build/UKQ1.240624.001)")
    ).toBe(false);
  });

  it("accepts ordinary desktop and iOS browsers", () => {
    expect(isNonHumanAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
    )).toBe(false);
    expect(isNonHumanAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1"
    )).toBe(false);
  });

  it("keeps the dedupe window at a sane length", () => {
    expect(CLICK_DEDUPE_WINDOW_MS).toBeGreaterThan(60_000);
    expect(CLICK_DEDUPE_WINDOW_MS).toBeLessThanOrEqual(60 * 60 * 1000);
  });
});
