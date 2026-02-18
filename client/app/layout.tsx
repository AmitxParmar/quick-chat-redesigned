import ClientSocketListener from "@/components/common/client-socket-listener";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/provider/theme-provider";
import QueryProvider from "@/provider/query-provider";
import { Toaster } from "@/components/ui/sonner"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Quick Chat",
  description: "Real-time messenger",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html suppressHydrationWarning lang="en">
      <head>
        <link rel="prefetch" as="image" href="/chat-bg.png" fetchPriority="high" />
      </head>
      <body
        className={`${inter.variable} font-inter antialiased max-h-screen h-screen`}
      >
        <QueryProvider>
          <ClientSocketListener />
          <ThemeProvider>{children}</ThemeProvider>
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  );
}
