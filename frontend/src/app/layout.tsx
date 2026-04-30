import type { Metadata } from "next";
import { headers } from "next/headers";
import { Plus_Jakarta_Sans, IBM_Plex_Mono, Playfair_Display } from "next/font/google";
import { ViewTransitions } from "next-view-transitions";
import { ThemeProvider } from "next-themes";
import { Providers } from "@/providers/providers";
import { ErrorBoundary } from "@/components/error/error-boundary";
import { ErrorLoggerProvider } from "@/providers/error-logger-provider";
import { Toaster } from "@/components/ui/sonner";
import { CommandPalette } from "@/components/navigation/command-palette";
import "./globals.css";
import GGPixelClient from "../../ez-pixel.client";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
});

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: {
    default: "AMG Portal",
    template: "%s | AMG Portal",
  },
  description:
    "Anchor Mill Group — Client & Partner Portal",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read the per-request CSP nonce forwarded by middleware.ts on the `x-nonce`
  // request header. Awaiting `headers()` opts this layout into dynamic
  // rendering so Next.js 16 can propagate the nonce to its injected framework
  // scripts (required for `script-src 'nonce-...' 'strict-dynamic'` to work).
  // The value is intentionally unused below — it just needs to be read.
  // When explicit <Script> tags are added, pass `nonce={nonce}` to them.
  // Pattern source: github.com/builderz-labs/mission-control/src/app/layout.tsx
  // and github.com/JustAJobApp/jobseeker-analytics/frontend/app/layout.tsx.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  void nonce;

  return (
    <ViewTransitions>
      <html lang="en" suppressHydrationWarning>
        <head>
          {/* Skip to main content link for screen readers */}
          <link rel="help" href="/accessibility" title="Accessibility Statement" />
        </head>
        <body
          className={`${plusJakarta.variable} ${ibmPlexMono.variable} ${playfairDisplay.variable} antialiased`}
        >
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem={true}>
            <Toaster />
            <ErrorBoundary>
              <ErrorLoggerProvider>
                <Providers>
                  <CommandPalette />
                  <GGPixelClient />
                  {children}
                </Providers>
              </ErrorLoggerProvider>
            </ErrorBoundary>
          </ThemeProvider>
        </body>
      </html>
    </ViewTransitions>
  );
}
