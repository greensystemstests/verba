import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Verba — Translation, without the back-and-forth",
  description: "Specialist translation in medical, legal, finance, technology and marketing. Estimate, manage and deliver every project in one workspace.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}<Toaster richColors position="bottom-right" /></body>
    </html>
  );
}
