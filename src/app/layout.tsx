import type { Metadata } from "next";
import { Bricolage_Grotesque, Lato } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Providers from "@/components/Providers";
// // import MobileGuard from "@/components/MobileGuard";
import "./globals.css";

const headingFont = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["400", "500", "600", "700"],
});

const bodyFont = Lato({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["300", "400", "700"],
});
export const metadata: Metadata = {
  metadataBase: new URL("https://ffcs.microsoftinnovations.club"),
  title: "VIT Chennai FFCS Timetable Planner & Schedule Builder | MIC",
  description: "The ultimate VIT Chennai FFCS timetable planner. Generate clash-free schedules, visually map your slots, export your timetable grid, and share it with friends.",
  keywords: [
    "VIT Chennai FFCS",
    "FFCS VIT Chennai",
    "FFCS Planner",
    "VIT Timetable Planner",
    "VIT Timetable Builder",
    "clash free timetable generator",
    "VIT course registration slots",
  ],
  applicationName: "VIT Chennai FFCS Timetable Planner",
  icons: {
    icon: "/mic-logo.png",
    shortcut: "/mic-logo.png",
    apple: "/mic-logo.png",
  },
  openGraph: {
    title: "VIT Chennai FFCS Timetable Planner & Schedule Builder",
    description: "Generate your perfect clash-free VIT Chennai FFCS timetable grid easily.",
    url: "https://ffcs.microsoftinnovations.club",
    siteName: "VIT Chennai FFCS Timetable Planner by MIC",
    images: [
      {
        url: "/mic-logo.png",
        width: 800,
        height: 600,
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "VIT Chennai FFCS Timetable Planner by MIC",
    description: "Generate your perfect clash-free VIT Chennai FFCS timetable grid easily.",
    images: ["/mic-logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
         className={`${headingFont.variable} ${bodyFont.variable} antialiased`}
      >
        <Providers>
          {/* <MobileGuard> */}
          {children}
          {/* </MobileGuard> */}
          <Analytics />
          <SpeedInsights />
        </Providers>
      </body>
    </html>
  );
}
