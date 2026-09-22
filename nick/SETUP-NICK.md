# OpenReply for @nicktoroun.ai — your part

Already done: cloned and pinned (commit 5760181, 284 tests passing), secrets
generated in `.env`, Vercel project `nicktoroun-openreply` created and linked,
sign-in locked to the ALLOWED_EMAILS address.

Everything below needs your login, so it's yours. Paste each value into
`~/Projects/openreply/.env` (never into chat), then tell me "done with N".

---

## 1. Neon — the database (free)

1. Sign up at https://neon.tech (GitHub login is fine).
2. Create a project `openreply`, region **AWS Europe (Frankfurt)**.
3. Dashboard → **Connect** → copy the connection string (starts `postgresql://`,
   ends `?sslmode=require`).
4. `.env` → `DATABASE_URL=`

## 2. Redis Cloud — the send queue (free)

1. Sign up at https://redis.io/try-free
2. Create a **free / Essentials 30 MB** database, cloud AWS, region eu-central-1.
3. Open it → **Connect** → copy the `redis://default:<password>@<host>:<port>` URL.
4. `.env` → `REDIS_URL=`

## 3. Resend — your login emails (free)

1. Sign up at https://resend.com **with the ALLOWED_EMAILS address**. That's what lets
   the test sender `onboarding@resend.dev` deliver without verifying a domain.
2. API Keys → Create → "Sending access".
3. `.env` → `RESEND_API_KEY=`

## 4. Meta app — the Instagram connection (free)

Needs the Vercel URL live first, so do steps 1–3, tell me, and I'll deploy.
Then:

1. https://developers.facebook.com/apps → Create app → type **Business**.
2. Use case: **Manage messaging and content on Instagram**. NOT Marketing API,
   NOT Facebook Login.
3. Instagram → API setup with Instagram login:
   - Instagram app ID → `.env` `INSTAGRAM_APP_ID=`
   - Instagram app secret (Show) → `.env` `INSTAGRAM_APP_SECRET=`
4. App settings → Basic → App secret (Show) → `.env` `FACEBOOK_APP_SECRET=`
5. App roles → Roles → **Instagram testers** → add `nicktoroun.ai`.
   Then in Instagram on your phone: Settings and activity → Apps and websites →
   **Tester invites** → Accept. (Skipping this = "Insufficient Developer Role".)
6. Business login settings → OAuth redirect URI:
   `https://nicktoroun-openreply.vercel.app/api/instagram/callback`
7. Configure webhooks:
   - Callback URL: `https://nicktoroun-openreply.vercel.app/api/webhook`
   - Verify token: the `WEBHOOK_VERIFY_TOKEN` line in `.env`
   - Verify and save, then subscribe to **comments** and **messages**.
8. Publish (left sidebar). URLs it asks for:
   - https://nicktoroun-openreply.vercel.app/privacy
   - https://nicktoroun-openreply.vercel.app/terms
   - https://nicktoroun-openreply.vercel.app/data-deletion

Real comments only arrive once the app is **published**.

## 5. Oracle Cloud — the always-on DM sender (free)

1. Sign up at https://signup.cloud.oracle.com — home region **Germany Central
   (Frankfurt)**. It asks for a card to verify; Always Free isn't charged.
2. Compute → Instances → Create:
   - Image **Ubuntu 22.04**, shape **VM.Standard.E2.1.Micro** (Always Free).
   - Download the SSH private key it offers → save as `~/.ssh/oracle-openreply.key`.
3. Send me the instance's **public IP**. I'll run the setup script over SSH.

Oracle can reclaim Always Free VMs that sit idle for 7 days, and a DM sender is
mostly idle. The clean fix is **Upgrade to Pay As You Go** in billing: Always
Free resources stay free, but idle ones stop being reclaimed. Only create
"Always Free-eligible" things after that, since anything else would be billed.

---

## After that (me)

- push `.env` to Vercel, deploy, run migrations
- worker on the VM via `nick/worker-setup.sh`
- check `/api/health` shows the worker healthy
- one TEST campaign, commented from a second account
- rebuild the META / OBSIDIAN / SKILL / PLUGINS flows as OpenReply campaigns
