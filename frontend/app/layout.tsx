import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";

import SmoothScroll from "@/components/SmoothScroll";

import "./globals.css";


const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
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
        className={`${jetbrainsMono.variable} antialiased`}
      >
        <SmoothScroll />
        {children}
      </body>
    </html>
  );
}
