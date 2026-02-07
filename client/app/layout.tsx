import GlobalSocketListener from "@/components/common/global-socket-listener";
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
      <body
        className={`${inter.variable} font-inter zoom-in-100 antialiased max-h-screen h-screen`}
      >
        <QueryProvider>
          <GlobalSocketListener />
          <ThemeProvider>{children}</ThemeProvider>
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  );
}
