import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/components/i18n";
import { getLang, textOverrides } from "@/lib/i18n-server";
import { dirOf } from "@/lib/i18n/core";

export const metadata: Metadata = {
  title: "Verba — Translation, without the back-and-forth",
  description: "Specialist translation in medical, legal, finance, technology and marketing. Estimate, manage and deliver every project in one workspace.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const lang = await getLang();
  const overrides = await textOverrides(lang);
  return (
    <html lang={lang} dir={dirOf(lang)}>
      <body className="antialiased"><I18nProvider lang={lang} overrides={overrides}>{children}</I18nProvider><Toaster richColors position={lang === "he" ? "bottom-left" : "bottom-right"} /></body>
    </html>
  );
}
