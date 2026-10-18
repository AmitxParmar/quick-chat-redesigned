import ClientSocketListener from "@/components/common/client-socket-listener";
import ClientVitalsReporter from "@/components/common/client-vitals-reporter";
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

// Preconnect to the API origin when it is an absolute URL, so the
// socket + REST handshake isn't delayed by DNS/TLS setup.
const apiOrigin: string | null = (() => {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base || !base.startsWith("http")) return null;
  try {
    return new URL(base).origin;
  } catch {
    return null;
  }
})();

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
        {apiOrigin ? <link rel="preconnect" href={apiOrigin} /> : null}
        <link rel="prefetch" as="image" href="/chat-bg.png" fetchPriority="high" />
      </head>
      <body
        className={`${inter.variable} font-inter antialiased max-h-screen h-screen`}
      >
        <QueryProvider>
          <ClientSocketListener />
          <ClientVitalsReporter />
          <ThemeProvider>{children}</ThemeProvider>
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  );
}
