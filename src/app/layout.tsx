import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import LayoutShell from "@/components/navigation/LayoutShell";
import { ToastProvider } from "@/components/ui";
import OnboardingProvider from "@/components/OnboardingProvider";

export const metadata: Metadata = {
  title: "CSRoma - Gestione Società Sportiva",
  description: "WebApp per la gestione completa della società sportiva CSRoma",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className="antialiased min-h-screen"
      >
        <ThemeProvider>
          <ToastProvider>
            <OnboardingProvider>
              <LayoutShell>{children}</LayoutShell>
            </OnboardingProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
