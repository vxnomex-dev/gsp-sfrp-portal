import type { Metadata } from "next";
import "./globals.css";
import { Footer, Header } from "@/components/SiteChrome";
import { site } from "@/lib/site";
import { THEME_SCRIPT } from "@/lib/theme";

export const metadata: Metadata = {
  title: {
    default: `${site.name} | ${site.community} (ERLC)`,
    template: `%s | ${site.name} (${site.community})`,
  },
  description: `The Florida Highway Patrol of ${site.community} — a roleplay community on ${site.game}.`,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
