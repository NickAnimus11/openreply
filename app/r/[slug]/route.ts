import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getRequestIp, hashClickIp } from "@/lib/tracking/server";
import { CLICK_DEDUPE_WINDOW_MS, isNonHumanAgent } from "@/lib/tracking/click-filter";

type RedirectRouteProps = {
  params: Promise<{ slug: string }>;
};

export async function GET(request: NextRequest, { params }: RedirectRouteProps) {
  const { slug } = await params;
  const trackedLink = await prisma.trackedLink.findUnique({
    where: { slug },
    select: {
      id: true,
      workspaceId: true,
      automationId: true,
      destinationUrl: true,
      automation: {
        select: {
          instagramAccountId: true,
        },
      },
    },
  });

  if (!trackedLink) {
    return NextResponse.redirect(new URL("/", request.url), { status: 302 });
  }

  // The redirect happens either way. Only the analytics row is conditional: a click
  // count that includes tooling and link unfurlers is worse than one that misses a
  // few, because it is the number the DM funnel gets judged by.
  const userAgent = request.headers.get("user-agent");
  const ipHash = hashClickIp(getRequestIp(request));

  if (!isNonHumanAgent(userAgent)) {
    const since = new Date(Date.now() - CLICK_DEDUPE_WINDOW_MS);
    const alreadyCounted = await prisma.linkClick.findFirst({
      where: { trackedLinkId: trackedLink.id, ipHash, createdAt: { gte: since } },
      select: { id: true },
    });

    if (!alreadyCounted) {
      // Never let an analytics failure cost the visitor their redirect.
      await prisma.linkClick
        .create({
          data: {
            workspaceId: trackedLink.workspaceId,
            automationId: trackedLink.automationId,
            instagramAccountId: trackedLink.automation.instagramAccountId,
            trackedLinkId: trackedLink.id,
            ipHash,
            userAgent,
            referrer: request.headers.get("referer"),
          },
        })
        .catch((error) => {
          console.error("[Redirect] Failed to record click:", error);
        });
    }
  }

  return NextResponse.redirect(trackedLink.destinationUrl, { status: 302 });
}
