import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Outfit } from "next/font/google";
import "./globals.css";

// Outfit for anything human, mono for anything counted (brandbook 05).
const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-outfit",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains",
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
  themeColor: "#8FA6BF",
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
    <html
      lang="en"
      className={`${outfit.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
