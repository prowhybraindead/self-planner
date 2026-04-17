import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { AuthProvider } from "@/components/providers/auth-provider";
import { PlatformBootstrap } from "@/components/providers/platform-bootstrap";

export const metadata: Metadata = {
  title: "SelfPlanner — Personal Life Planner",
  description: "Dự án cá nhân • Dark mode only • Background thư giãn",
  icons: {
    icon: "/brand/selfplanner-icon.svg",
    shortcut: "/brand/selfplanner-icon.svg",
    apple: "/brand/selfplanner-icon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#000000",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <PlatformBootstrap />
          {children}
          <Toaster
            position="top-center"
            toastOptions={{
              style: {
                background: "rgba(8, 16, 34, 0.88)",
                border: "1px solid rgba(148, 196, 255, 0.28)",
                color: "#e8f3ff",
                backdropFilter: "blur(14px)",
              },
            }}
            richColors
          />
        </AuthProvider>
      </body>
    </html>
  );
}
