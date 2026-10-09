// @TheTechMargin 2026
import { normalizeHex } from "@/lib/color";

/** Accepts "2563eb" and "#2563eb" — dotenv reads a bare leading "#" as a
 *  comment start, which silently empties unquoted hex values. */
function hex(value: string | undefined, fallback: string): string {
  return normalizeHex(value) ?? fallback;
}

export interface EventLensConfig {
  eventName: string;
  eventYear: string;
  eventTagline: string;
  /** Organizer logo URL (SVG/PNG). Empty string = text-only header. */
  logoUrl: string;
  /** Light or dark color scheme. */
  theme: "dark" | "light";
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  geminiApiKey: string;
  googleApiKey: string;
  driveFolderId: string;
  adminSecret: string;
  // Service Account credentials (for private folders)
  googleClientEmail: string;
  googlePrivateKey: string;
}

export const config: EventLensConfig = {
  eventName: process.env.NEXT_PUBLIC_EVENT_NAME || "Фотогалерея",
  eventYear: process.env.NEXT_PUBLIC_EVENT_YEAR || "2026",
  eventTagline:
    process.env.NEXT_PUBLIC_EVENT_TAGLINE || "Найдите себя на снимках мероприятия",
  logoUrl: process.env.NEXT_PUBLIC_LOGO_URL || "",
  theme: process.env.NEXT_PUBLIC_THEME === "light" ? "light" : "dark",
  primaryColor: hex(process.env.NEXT_PUBLIC_PRIMARY_COLOR, "#00ff41"),
  secondaryColor: hex(process.env.NEXT_PUBLIC_SECONDARY_COLOR, "#ff00ff"),
  accentColor: hex(process.env.NEXT_PUBLIC_ACCENT_COLOR, "#ff00ff"),
  backgroundColor: hex(
    process.env.NEXT_PUBLIC_BG_COLOR,
    process.env.NEXT_PUBLIC_THEME === "light" ? "#f7f7f5" : "#1a1a1a",
  ),
  surfaceColor: hex(
    process.env.NEXT_PUBLIC_SURFACE_COLOR,
    process.env.NEXT_PUBLIC_THEME === "light" ? "#ffffff" : "#222222",
  ),
  textColor: hex(
    process.env.NEXT_PUBLIC_TEXT_COLOR,
    process.env.NEXT_PUBLIC_THEME === "light" ? "#1a1a1a" : "#e0e0e0",
  ),
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  googleApiKey: process.env.GOOGLE_API_KEY || "",
  driveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID || "",
  adminSecret: process.env.ADMIN_API_SECRET || "",
  googleClientEmail: process.env.GOOGLE_CLIENT_EMAIL || "",
  googlePrivateKey: process.env.GOOGLE_PRIVATE_KEY || "",
};
