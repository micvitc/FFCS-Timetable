import type { Metadata } from "next";
import { Bricolage_Grotesque, Lato } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import Providers from "@/components/Providers";
import MobileGuard from "@/components/MobileGuard";
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
  title: "FFCS Planner - Build Your Timetable | MIC",
  description: "Plan and build your perfect timetable with the FFCS Planner. Generate clash-free schedules, export them, and share them with your friends.",
  keywords: ["FFCS", "VIT", "Timetable Planner", "Course Selection", "VIT Chennai"],
  icons: {
    icon: "/mic-logo.png",
    shortcut: "/mic-logo.png",
    apple: "/mic-logo.png",
  },
  openGraph: {
    title: "FFCS Planner",
    description: "Build your perfect clash-free timetable easily.",
    url: "https://ffcs.microsoftinnovations.club",
    siteName: "FFCS Planner by MIC",
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
    title: "FFCS Planner by MIC",
    description: "Build your perfect clash-free timetable easily.",
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
          <MobileGuard>{children}</MobileGuard>
          <Analytics />
        </Providers>
      </body>
    </html>
  );
}
