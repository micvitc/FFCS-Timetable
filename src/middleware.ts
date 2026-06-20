import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Skip CSP in development — Turbopack HMR, blob: style chunks, and WebSocket
  // connections all conflict with a strict nonce-based policy.
  if (process.env.NODE_ENV !== "production") {
    return NextResponse.next();
  }

  // ---------------------------------------------------------------------------
  // Content Security Policy
  // ---------------------------------------------------------------------------
  const csp = [
    "default-src 'self'",

    // Scripts: Allow self, inline scripts for Next.js/PostHog hydration, and trusted CDN domains
    [
      "script-src 'self'",
      "'unsafe-inline'",
      "'unsafe-eval'",
      "https://va.vercel-scripts.com",
      "https://vitals.vercel-insights.com",
      "https://us.posthog.com",
      "https://eu.posthog.com",
      "https://us.i.posthog.com",
      "https://eu.i.posthog.com",
      "https://us-assets.i.posthog.com",
      "https://eu-assets.i.posthog.com",
      "https://t.microsoftinnovations.club",
    ].join(" "),

    // Styles: unsafe-inline is acceptable (CSS injection risk << XSS risk)
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",

    // Fonts: Google Fonts static CDN
    "font-src 'self' https://fonts.gstatic.com",

    // Images: Google OAuth avatars + UploadThing CDN
    "img-src 'self' data: blob: https://lh3.googleusercontent.com https://h8z6stjynz.ufs.sh",

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
      "https://eu.posthog.com",
      "https://us.i.posthog.com",
      "https://eu.i.posthog.com",
      "https://us-assets.i.posthog.com",
      "https://eu-assets.i.posthog.com",
    ].join(" "),

    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");

  const response = NextResponse.next();
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
