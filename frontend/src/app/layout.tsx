import type { Metadata } from "next";
import { Geist, IBM_Plex_Mono, Playfair_Display } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Providers } from "@/providers/providers";
import { ErrorBoundary } from "@/components/error/error-boundary";
import { CommandPalette } from "@/components/navigation/command-palette";
import { KeyboardShortcutsDialogProvider } from "@/components/ui/keyboard-shortcuts-dialog";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
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
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Skip to main content link for screen readers */}
        <link rel="help" href="/accessibility" title="Accessibility Statement" />
      </head>
      <body
        className={`${geistSans.variable} ${ibmPlexMono.variable} ${playfairDisplay.variable} antialiased`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem={true}>
          <ErrorBoundary>
            <KeyboardShortcutsDialogProvider>
              <Providers>
                <CommandPalette />
                {children}
              </Providers>
            </KeyboardShortcutsDialogProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </body>
    </html>
  );
}
