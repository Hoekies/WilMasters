import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Footer from "@/components/Footer";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL('https://wm2026-opal.vercel.app'),
  title: "Willemien's Masters",
  description: "Live golf score-app voor kleine groepen",
  icons: {
    icon: '/favicon.ico',
    apple: '/icon.png',
  },
  openGraph: {
    title: "Willemien's Masters",
    description: "Live golf score-app voor kleine groepen",
    images: [{ url: '/logo.png', width: 500, height: 500 }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className={`${geist.variable} h-full antialiased`} style={{ isolation: 'isolate' }}>
      <body className="min-h-full flex flex-col font-sans relative" style={{ background: "#2c4530", color: "#e0e0e0" }}>
        {children}
        <Footer />
      </body>
    </html>
  );
}
