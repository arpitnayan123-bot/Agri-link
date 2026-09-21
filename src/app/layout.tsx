import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Baloo_2 } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Providers } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const baloo = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin", "devanagari"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "AgriLink — Farm to door in hours. Zero middlemen.",
  description:
    "Farmer-direct quick commerce for India: fresh, chemical-free produce from 7 verified farms in Maharashtra & Punjab, delivered in ~2 hours. Every farmer is paid instantly over UPI — no middlemen, no cold storage. AI freshness scores, AI basket building and honest receipts included.",
  keywords: ["farm to table", "farmer direct", "zero middlemen", "quick commerce", "fresh vegetables", "organic", "chemical free", "UPI", "India", "AI shopping"],
  authors: [{ name: "AgriLink" }],
  manifest: "/manifest.webmanifest",
  icons: { icon: "/agrilink-logo.png", apple: "/agrilink-logo.png" },
  openGraph: {
    title: "AgriLink — Farm to door in hours",
    description: "Fresh, chemical-free produce direct from verified farmers. Farmers paid instantly.",
    images: ["/agrilink-logo.png"],
  },
  appleWebApp: {
    capable: true,
    title: "AgriLink",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#17a24f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${baloo.variable} antialiased bg-background text-foreground`}
      >
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}
