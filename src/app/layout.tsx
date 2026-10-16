// @TheTechMargin 2026
import type { Metadata, Viewport } from "next";
import "./globals.css";
import Footer from "@/components/Footer";
import { contrastOn, normalizeHex } from "@/lib/color";

const eventName = process.env.NEXT_PUBLIC_EVENT_NAME || "Фотогалерея";
const eventTagline =
  process.env.NEXT_PUBLIC_EVENT_TAGLINE || "Найдите себя на снимках мероприятия";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: `${eventName} — Найдите свои фото`,
  description: eventTagline,
  // Иконки (icon.png / apple-icon.png) подхватываются из src/app автоматически
  openGraph: {
    title: `${eventName} — Найдите свои фото`,
    description: eventTagline,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Accepts "2563eb" and "#2563eb": dotenv treats a bare leading "#" as a
  // comment, so organizers frequently lose the value without quotes.
  const pick = (value: string | undefined, fallback: string) =>
    normalizeHex(value) ?? fallback;

  const theme = process.env.NEXT_PUBLIC_THEME === "light" ? "light" : "dark";

  // Theme-aware defaults; organizer's env values always win.
  const primaryColor = pick(process.env.NEXT_PUBLIC_PRIMARY_COLOR, "#00ff41");
  const accentColor = pick(process.env.NEXT_PUBLIC_ACCENT_COLOR, "#ff00ff");
  const light = theme === "light";
  const bgColor = pick(process.env.NEXT_PUBLIC_BG_COLOR, light ? "#f7f7f5" : "#1a1a1a");
  const surfaceColor = pick(process.env.NEXT_PUBLIC_SURFACE_COLOR, light ? "#ffffff" : "#222222");
  const textColor = pick(process.env.NEXT_PUBLIC_TEXT_COLOR, light ? "#1a1a1a" : "#e0e0e0");

  // Black-on-brand is unreadable when the brand color is dark, and white is
  // unreadable on light neons — pick by relative luminance instead of guessing.
  const onPrimary = contrastOn(primaryColor);

  // :root:root doubles specificity so these always win over the
  // defaults declared in globals.css, regardless of CSS order.
  const brandTokens = `:root:root {
    --el-primary: ${primaryColor};
    --el-accent: ${accentColor};
    --el-bg: ${bgColor};
    --el-surface: ${surfaceColor};
    --el-text: ${textColor};
    --el-on-primary: ${onPrimary};
  }`;

  return (
    <html lang="ru" className="dark" data-theme={theme}>
      <head>
        <meta name="theme-color" content={bgColor} />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        {process.env.PHOTO_SOURCE === "yandex" ? (
          <>
            <link rel="preconnect" href="https://downloader.disk.yandex.ru" />
            <link rel="dns-prefetch" href="https://downloader.disk.yandex.ru" />
          </>
        ) : (
          <>
            <link rel="preconnect" href="https://lh3.googleusercontent.com" />
            <link rel="dns-prefetch" href="https://lh3.googleusercontent.com" />
          </>
        )}
        {/* Brand tokens injected after globals.css so they override its defaults */}
        <style dangerouslySetInnerHTML={{ __html: brandTokens }} />
      </head>
      <body className="antialiased bg-[var(--el-bg)] text-[var(--el-text)] flex flex-col min-h-screen">
        <div className="flex-1">
          {children}
        </div>
        <Footer />
      </body>
    </html>
  );
}
