// @TheTechMargin 2026
import { PhotoRecord } from "./types";

export function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "только что";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} мин. назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч. назад`;
  const days = Math.floor(hours / 24);
  return `${days} дн. назад`;
}

export function isRecentlyUpdated(dateStr: string): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const now = new Date();
  return now.getTime() - date.getTime() < 5 * 60 * 1000;
}

/** Делит строку на первую фразу и хвост по первому "предложному"
 *  разделителю (. ! ? …) — для двухцветных hero-заголовков:
 *  первая часть рисуется светлой, вторая — в акцентном цвете ивента.
 *  Если разделителя нет, хвост остаётся пустым. */
export function splitFirstSentence(text: string): { first: string; rest: string } {
  const match = text.match(/^(\s*[^.!?…]+[.!?…]+)(\s+)([\s\S]*)$/);
  if (!match) return { first: text.trim(), rest: "" };
  return { first: match[1].trim(), rest: match[3].trim() };
}

export function isVideoFile(p: PhotoRecord): boolean {
  return p.mimeType?.startsWith("video/") || /\.(mp4|mov|webm|avi)$/i.test(p.filename);
}

export function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
