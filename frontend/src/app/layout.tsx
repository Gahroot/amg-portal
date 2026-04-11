import type { Metadata } from "next";
import { Plus_Jakarta_Sans, IBM_Plex_Mono, Playfair_Display } from "next/font/google";
import { ViewTransitions } from "next-view-transitions";
import { ThemeProvider } from "next-themes";
import { Providers } from "@/providers/providers";
import { ErrorBoundary } from "@/components/error/error-boundary";
import { ErrorLoggerProvider } from "@/providers/error-logger-provider";
import { Toaster } from "@/components/ui/sonner";
import { CommandPalette } from "@/components/navigation/command-palette";
import "./globals.css";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
