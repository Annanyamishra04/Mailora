import type { Metadata } from "next";
import "@fontsource-variable/fraunces";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-sans/700.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { AuthProvider } from "@/hooks/use-auth";
import { ToastProvider } from "@/hooks/use-toast";
import { Toaster } from "@/components/shared/toaster";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Mail Studio — Draft the email, not the excuses",
  description:
    "AI Mail Studio helps you write, rewrite, and reply to email in your own voice — in seconds, not sighs.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-paper text-ink font-sans antialiased">
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              {children}
              <Toaster />
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
