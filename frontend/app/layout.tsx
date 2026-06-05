import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";

import SmoothScroll from "@/components/SmoothScroll";
import Providers from "./providers";

import "./globals.css";


const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#111111",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: {
    default: "Askelad | Your AI Co-Founding Team",
    template: "%s | Askelad",
  },
  description: "Askelad is your AI-powered strategic partner. From GTM strategy to financial modeling, build and scale your startup with elite AI agents.",
  keywords: [
    "AI Startup Advisor",
    "AI Co-founder",
    "Startup Growth",
    "Founder Tools",
    "AI Strategic Partner",
    "GTM Strategy AI",
    "Financial Modeling for Startups",
  ],
  authors: [{ name: "Askelad Team" }],
  creator: "Askelad",
  metadataBase: new URL("https://askelad.vercel.app"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://askelad.vercel.app",
    siteName: "Askelad",
    title: "Askelad | Your AI Co-Founding Team",
    description: "Your elite AI co-founding team. Build faster, smarter, and more efficiently with specialized AI agents.",
    images: [
      {
        url: "/landing-preview.png",
        width: 1200,
        height: 630,
        alt: "Askelad Platform Preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Askelad | Your AI Co-Founding Team",
    description: "Elite AI agents for solo founders. Strategic guidance, finance, and marketing in one place.",
    images: ["/landing-preview.png"],
    creator: "@askelad",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
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
        className={`${manrope.variable} antialiased`}
      >
        <SmoothScroll />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
