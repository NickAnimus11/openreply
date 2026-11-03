import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    trackedLink: {
      findUnique: vi.fn(),
    },
    linkClick: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db/client", () => ({
  prisma: mockPrisma,
}));

import { GET } from "../app/r/[slug]/route";

// A real agent from the 2026-11-02 end-to-end test. The route now ignores tooling,
// so an invented agent like "vitest" would no longer exercise the counted path.
const BROWSER_UA =
  "Mozilla/5.0 (Linux; Android 14; 22101320G) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";

const linkRow = {
  id: "link_123",
  workspaceId: "workspace_123",
  automationId: "automation_123",
  destinationUrl: "https://example.com/offer",
  automation: { instagramAccountId: "instagram_account_123" },
};

const hit = (ua: string | null, ip = "203.0.113.10") =>
  GET(
    new Request("https://manychat-alternative.com/r/abc123", {
      headers: {
        ...(ua ? { "user-agent": ua } : {}),
        referer: "https://instagram.com/",
        "x-forwarded-for": ip,
      },
    }) as Parameters<typeof GET>[0],
    { params: Promise.resolve({ slug: "abc123" }) }
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe("tracked link redirect route", () => {
  it("logs a workspace-isolated click and redirects to the destination", async () => {
    mockPrisma.trackedLink.findUnique.mockResolvedValue({
      id: "link_123",
      workspaceId: "workspace_123",
      automationId: "automation_123",
      destinationUrl: "https://example.com/offer",
      automation: {
        instagramAccountId: "instagram_account_123",
      },
    });
    mockPrisma.linkClick.create.mockResolvedValue({});

    const response = await GET(
      new Request("https://manychat-alternative.com/r/abc123", {
        headers: {
          "user-agent": BROWSER_UA,
          referer: "https://instagram.com/",
          "x-forwarded-for": "203.0.113.10",
        },
      }) as Parameters<typeof GET>[0],
      { params: Promise.resolve({ slug: "abc123" }) }
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://example.com/offer");
    expect(mockPrisma.trackedLink.findUnique).toHaveBeenCalledWith({
      where: { slug: "abc123" },
      select: expect.any(Object),
    });
    expect(mockPrisma.linkClick.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace_123",
        automationId: "automation_123",
        instagramAccountId: "instagram_account_123",
        trackedLinkId: "link_123",
        userAgent: BROWSER_UA,
        referrer: "https://instagram.com/",
      }),
    });
  });

  it("redirects unknown slugs to the homepage without logging a click", async () => {
    mockPrisma.trackedLink.findUnique.mockResolvedValue(null);

    const response = await GET(
      new Request("https://manychat-alternative.com/r/missing") as Parameters<
        typeof GET
      >[0],
      { params: Promise.resolve({ slug: "missing" }) }
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://manychat-alternative.com/");
    expect(mockPrisma.linkClick.create).not.toHaveBeenCalled();
  });
});

describe("click filtering", () => {
  beforeEach(() => {
    mockPrisma.trackedLink.findUnique.mockResolvedValue(linkRow);
    mockPrisma.linkClick.findFirst.mockResolvedValue(null);
    mockPrisma.linkClick.create.mockResolvedValue({});
  });

  it("redirects tooling without counting it — the curl case that polluted real data", async () => {
    const response = await hit("curl/8.7.1");
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://example.com/offer");
    expect(mockPrisma.linkClick.create).not.toHaveBeenCalled();
  });

  it("does not count a link unfurler fetching on the recipient's behalf", async () => {
    await hit("facebookexternalhit/1.1");
    expect(mockPrisma.linkClick.create).not.toHaveBeenCalled();
  });

  it("does not count a request with no user agent", async () => {
    await hit(null);
    expect(mockPrisma.linkClick.create).not.toHaveBeenCalled();
  });

  it("counts the same person once inside the dedupe window", async () => {
    mockPrisma.linkClick.findFirst.mockResolvedValue({ id: "click_1" });
    const response = await hit(BROWSER_UA);
    expect(response.status).toBe(302);
    expect(mockPrisma.linkClick.create).not.toHaveBeenCalled();
  });

  it("still redirects when recording the click fails", async () => {
    mockPrisma.linkClick.create.mockRejectedValue(new Error("db down"));
    const response = await hit(BROWSER_UA);
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://example.com/offer");
  });
});
