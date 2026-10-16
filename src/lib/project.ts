// @TheTechMargin 2026
// Клиентские помощники для ссылок публичных страниц проектов.
// Публичная галерея проекта живёт по адресу /p/<key>; проект по
// умолчанию (без ключа) продолжает работать для старых ссылок.

/** Добавляет ?project=<key> к запросу API, если ключ не «default». */
export function withProjectParam(path: string, key: string | undefined): string {
  if (!key || key === "default") return path;
  return `${path}${path.includes("?") ? "&" : "?"}project=${encodeURIComponent(key)}`;
}
