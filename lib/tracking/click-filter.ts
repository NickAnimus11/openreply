/**
 * Which requests to /r/<slug> count as a click.
 *
 * Every request used to create a LinkClick row. That overstates engagement in two
 * ways seen in production on 2026-11-02: four `curl` checks made while verifying the
 * links wrote four clicks against a campaign before a human had touched it, and a
 * messaging app that unfurls a link preview fetches the URL on the recipient's behalf.
 *
 * The redirect itself is never blocked — a filtered request still 302s. Only the
 * analytics row is suppressed, because a wrong number is worse than a missing one
 * when it is the number a funnel is judged by.
 */

/** Window in which repeat requests from the same hashed IP count once. */
export const CLICK_DEDUPE_WINDOW_MS = 30 * 60 * 1000;

// Substrings, lowercased, matched against the user agent. Deliberately narrow:
// it catches tooling and link unfurlers, not real mobile or desktop browsers.
const NON_HUMAN = [
  "bot", "crawler", "spider", "slurp",
  "curl", "wget", "httpie", "python-requests", "axios", "node-fetch", "go-http-client",
  "facebookexternalhit", "instagram", "whatsapp", "telegrambot", "twitterbot",
  "linkedinbot", "slackbot", "discordbot", "embedly", "quora link preview",
  "preview", "headlesschrome", "playwright", "puppeteer", "lighthouse",
  "monitor", "uptimerobot", "pingdom",
];

/**
 * True when the user agent is tooling or a link unfurler rather than a person.
 * A missing user agent counts as non-human: every real browser sends one.
 */
export function isNonHumanAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent || !userAgent.trim()) return true;
  const ua = userAgent.toLowerCase();
  return NON_HUMAN.some((needle) => ua.includes(needle));
}
