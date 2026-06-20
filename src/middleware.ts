import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Skip CSP in development — Turbopack HMR, blob: style chunks, and WebSocket
  // connections all conflict with a strict nonce-based policy.
  if (process.env.NODE_ENV !== "production") {
    return NextResponse.next();
  }

  // Generate a fresh cryptographic nonce for every request.
  // Buffer.from(uuid).toString('base64') gives a URL-safe 24-char base64 string.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  // ---------------------------------------------------------------------------
  // Content Security Policy
  // ---------------------------------------------------------------------------
  // 'nonce-{nonce}'   — only scripts tagged with this nonce execute.
  // 'strict-dynamic'  — scripts loaded by a nonced script inherit trust,
  //                     so Vercel Analytics, PostHog, and Sentry all work
  //                     without being explicitly listed in script-src.
  // No 'unsafe-inline' or 'unsafe-eval' in script-src.
  // ---------------------------------------------------------------------------
  const csp = [
    "default-src 'self'",

    // Scripts: nonce + strict-dynamic removes unsafe-inline and unsafe-eval
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,

    // Styles: unsafe-inline is acceptable (CSS injection risk << XSS risk)
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",

    // Fonts: Google Fonts static CDN
    "font-src 'self' https://fonts.gstatic.com",

    // Images: Google OAuth avatars
    "img-src 'self' data: blob: https://lh3.googleusercontent.com",

    // Media: UploadThing video CDN
    "media-src 'self' https://h8z6stjynz.ufs.sh",

    // Frames: YouTube nocookie embeds only
    "frame-src https://www.youtube-nocookie.com",

    // Network: Vercel, Sentry EU, PostHog (custom proxy + UI host)
    [
      "connect-src 'self'",
      "https://va.vercel-scripts.com",
      "https://vitals.vercel-insights.com",
      "https://o4511123083689984.ingest.de.sentry.io",
      "https://t.microsoftinnovations.club",
      "https://us.posthog.com",
      "https://us-assets.i.posthog.com",
    ].join(" "),

    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");

  // Forward the nonce to the root layout via a request header.
  // layout.tsx reads it with headers().get('x-nonce') and passes it to
  // <Script> components so Next.js attaches nonce= to its injected <script> tags.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);

  return response;
}

export const config = {
  matcher: [
    {
      // Run on all routes except Next.js internal paths and static file extensions.
      source:
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
      missing: [
        // Skip Next.js prefetch requests — no need to spend time on nonce generation
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
