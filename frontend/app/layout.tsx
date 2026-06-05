import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";

import SmoothScroll from "@/components/SmoothScroll";
import Providers from "./providers";

import "./globals.css";


const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Askelad",
  description: "Your AI co-founding team",
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
        <Analytics />
      </body>
    </html>
  );
}
