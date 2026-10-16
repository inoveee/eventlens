// @TheTechMargin 2026
// Подвал галереи скрыт на страницах организатора — там своя оболочка.
"use client";

import { usePathname } from "next/navigation";
import Footer from "./Footer";

export default function FooterGate() {
  const pathname = usePathname();
  if (pathname && pathname.startsWith("/organizer")) return null;
  return <Footer />;
}
