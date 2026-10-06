import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import LayoutShell from "@/components/navigation/LayoutShell";
import { ToastProvider } from "@/components/ui";
import OnboardingProvider from "@/components/OnboardingProvider";
import { AuthProvider } from "@/hooks/useAuth";
import { AccessibleProfileProvider } from "@/context/AccessibleProfileContext";
import { TeamProvider } from "@/context/TeamContext";
import PwaBootstrap from "@/components/pwa/PwaBootstrap";
import { QueryProvider, QuerySessionCacheBoundary } from "@/components/providers/QueryProvider";

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
      { url: "/images/new_csroma_logo_no_bg.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192-v2.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512-v2.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon-180-v2.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#D71920" },
    { media: "(prefers-color-scheme: dark)", color: "#0B1220" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(() => { try { const key = 'csroma-theme'; const saved = localStorage.getItem(key); const dark = saved === 'dark' || (saved !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches); document.documentElement.classList.toggle('theme-dark', dark); document.documentElement.style.colorScheme = dark ? 'dark' : 'light'; } catch (_) {} })()` }} />
      </head>
      <body
        className="antialiased min-h-screen"
      >
        <ThemeProvider>
          <PwaBootstrap />
          <ToastProvider>
            <OnboardingProvider>
              <AuthProvider>
                <QueryProvider>
                  <QuerySessionCacheBoundary>
                    <AccessibleProfileProvider>
                      <TeamProvider>
                        <LayoutShell>{children}</LayoutShell>
                      </TeamProvider>
                    </AccessibleProfileProvider>
                  </QuerySessionCacheBoundary>
                </QueryProvider>
              </AuthProvider>
            </OnboardingProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
