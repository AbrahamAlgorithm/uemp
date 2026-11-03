import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";

import { SessionProvider } from "@/components/session-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });

export const metadata: Metadata = {
  title: {
    default: "UEMP",
    template: "%s · UEMP",
  },
  description: "University Education Management Portal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${manrope.variable}`}>
      <body className="font-sans antialiased">
        <TooltipProvider>
          <SessionProvider>{children}</SessionProvider>
        </TooltipProvider>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
