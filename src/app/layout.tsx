import type { Metadata } from "next";
import { Mohave } from "next/font/google";
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
      { url: "/delta_logo.svg", type: "image/svg+xml" },
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
      <body>{children}</body>
    </html>
  );
}
