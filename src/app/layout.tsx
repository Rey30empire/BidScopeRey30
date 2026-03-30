import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/branding";

const headingSans = Space_Grotesk({
  variable: "--font-heading-sans",
  subsets: ["latin"],
});

const bodyMono = IBM_Plex_Mono({
  variable: "--font-body-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: `${APP_NAME} | Construction Bid Intelligence`,
  description: APP_DESCRIPTION,
  keywords: ["construction", "bid analysis", "estimating", "subcontractor", "scope review", "bid package"],
  icons: {
    icon: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${headingSans.variable} ${bodyMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers>
          {children}
          <Toaster richColors position="bottom-right" />
        </Providers>
      </body>
    </html>
  );
}
