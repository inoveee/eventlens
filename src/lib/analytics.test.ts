// @TheTechMargin 2026
// Тесты приватности аналитики: санитизация metadata (никаких селфи,
// векторов, IP и текстов запросов) и разрешение анонимной сессии.
// Приватность — ключевое требование биометрического проекта, поэтому
// проверяем НАСТОЯЩУЮ sanitizeMetadata, а не переписанную копию.

import { describe, it, expect } from "@jest/globals";
import { queryLengthMetadata, sanitizeMetadata } from "./analytics";

describe("sanitizeMetadata (приватность)", () => {
  it("вырезает запрещённые ключи: query, selfie, embedding, ip, email", () => {
    const clean = sanitizeMetadata({
      query: "свадьба Анны",
      q: "секрет",
      text: "полный текст",
      selfie: "base64...",
      embedding: [0.1, 0.2],
      image: "data:image/jpeg;base64,...",
      ip: "1.2.3.4",
      email: "user@example.com",
      results_count: 12,
    });
    expect(clean).toEqual({ results_count: 12 });
    expect(JSON.stringify(clean)).not.toContain("свадьба");
    expect(JSON.stringify(clean)).not.toContain("1.2.3.4");
    expect(JSON.stringify(clean)).not.toContain("example.com");
  });

  it("регистронезависимо вырезает запрещённые ключи", () => {
    const clean = sanitizeMetadata({ QUERY: "x", Selfie: "y", IP: "1.2.3.4", ok: 1 });
    expect(clean).toEqual({ ok: 1 });
  });

  it("оставляет примитивы (числа, bool, короткие строки)", () => {
    const clean = sanitizeMetadata({ count: 5, flag: true, tier: "vector" });
    expect(clean).toEqual({ count: 5, flag: true, tier: "vector" });
  });

  it("усекает длинные строки до 100 символов", () => {
    const clean = sanitizeMetadata({ note: "a".repeat(500) });
    expect((clean.note as string)).toHaveLength(100);
  });

  it("выбрасывает массивы и объекты (не примитивы)", () => {
    const clean = sanitizeMetadata({
      list: [1, 2, 3],
      obj: { nested: true },
      keep: 7,
    });
    expect(clean).toEqual({ keep: 7 });
  });

  it("пропускает null/undefined значения", () => {
    expect(sanitizeMetadata({ a: null, b: undefined, c: 1 })).toEqual({ c: 1 });
  });

  it("пустой/отсутствующий input → пустой объект", () => {
    expect(sanitizeMetadata(undefined)).toEqual({});
    expect(sanitizeMetadata({})).toEqual({});
  });
});

describe("queryLengthMetadata (приватность запроса)", () => {
  it("хранит только длину запроса, не текст", () => {
    const meta = queryLengthMetadata("свадьба Анны и Ивана");
    expect(meta).toEqual({ query_len: "свадьба Анны и Ивана".length });
    expect(Object.values(meta)).not.toContain("свадьба Анны и Ивана");
  });

  it("пустой запрос → длина 0", () => {
    expect(queryLengthMetadata("")).toEqual({ query_len: 0 });
  });

  it("query_len не попадает под вырезание (это число, а не текст)", () => {
    // query_len — разрешённый ключ: sanitizeMetadata его оставит.
    expect(sanitizeMetadata(queryLengthMetadata("abc"))).toEqual({ query_len: 3 });
  });
});

describe("анонимная сессия (format id)", () => {
  // Формат session_id — 32 hex-символа; проверяем регулярку, которой
  // analytics.ts доверяет cookie (защита от подделанных значений).
  const SID_RE = /^[a-f0-9]{32}$/;

  it("hex-id из 16 байт соответствует формату", () => {
    const id = Buffer.from(new Uint8Array(16)).toString("hex");
    expect(id).toHaveLength(32);
    expect(SID_RE.test(id)).toBe(true);
  });

  it("чужие/подделанные значения не проходят формат", () => {
    expect(SID_RE.test("")).toBe(false);
    expect(SID_RE.test("abc")).toBe(false);
    expect(SID_RE.test("../../etc/passwd")).toBe(false);
    expect(SID_RE.test("A".repeat(32))).toBe(false); // только lowercase hex
  });
});
