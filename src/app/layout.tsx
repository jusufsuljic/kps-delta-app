import type { Metadata } from "next";
import { Mohave } from "next/font/google";
import { Suspense } from "react";
import { LoadingBar } from "@/components/LoadingBar";
import { ScrollPreserver } from "@/components/ScrollPreserver";
import "./globals.css";

const mohave = Mohave({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mohave",
  display: "swap",
});

export const metadata: Metadata = {
  title: "KPS Delta App",
  description: "Shooting leaderboard and admin dashboard for KPS Delta.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.ico", sizes: "32x32", type: "image/x-icon" },
      { url: "/favicon-16x16.ico", sizes: "16x16", type: "image/x-icon" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={mohave.variable}>
      <body>
        <Suspense fallback={null}>
          <LoadingBar />
        </Suspense>
        <Suspense fallback={null}>
          <ScrollPreserver />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
