import type { Metadata, Viewport } from "next";
import { Instrument_Sans } from "next/font/google";
import "./globals.css";

const instrument = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
});

export const metadata: Metadata = {
  title: {
    default: "Intramural — run your school league like the pros",
    template: "%s · Intramural",
  },
  description:
    "Drafts, lunch-period scheduling, live courtside stats, standings, trades, and playoffs for school intramural leagues.",
  applicationName: "Intramural",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Intramural",
  },
};

export const viewport: Viewport = {
  themeColor: "#8399ac",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${instrument.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
