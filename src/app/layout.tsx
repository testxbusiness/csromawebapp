import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import LayoutShell from "@/components/navigation/LayoutShell";
import { ToastProvider } from "@/components/ui";
import OnboardingProvider from "@/components/OnboardingProvider";
import { AuthProvider } from "@/hooks/useAuth";
import { AccessibleProfileProvider } from "@/context/AccessibleProfileContext";
import PwaBootstrap from "@/components/pwa/PwaBootstrap";

export const metadata: Metadata = {
  title: "CSRoma - Gestione Società Sportiva",
  description: "WebApp per la gestione completa della società sportiva CSRoma",
  applicationName: "CSRoma Control Center",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "CSRoma",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon-180.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#d71920" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body
        className="antialiased min-h-screen"
      >
        <ThemeProvider>
          <PwaBootstrap />
          <ToastProvider>
            <OnboardingProvider>
              <AuthProvider>
                <AccessibleProfileProvider>
                  <LayoutShell>{children}</LayoutShell>
                </AccessibleProfileProvider>
              </AuthProvider>
            </OnboardingProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
