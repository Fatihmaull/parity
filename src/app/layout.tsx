import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ConventionProvider } from "@/components/ConventionContext";
import { Nav } from "@/components/Nav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PARITY — PreStocks terminal",
  description:
    "Read-only PreStocks analytics for Solana STOCKLANA. ScaledUiAmount-aware premiums, convention check, IPO ladders.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ConventionProvider>
          <Nav />
          <div className="flex-1">{children}</div>
        </ConventionProvider>
      </body>
    </html>
  );
}
