import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Footer from "@/components/Footer";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Golf z'n Loatst",
  description: "Live golf score-app voor kleine groepen",
  icons: { icon: "/favicon.png" },
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans" style={{ background: "#1c3a1c", color: "#fff" }}>
        {children}
        <Footer />
      </body>
    </html>
  );
}
