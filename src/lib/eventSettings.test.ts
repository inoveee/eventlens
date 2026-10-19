// @TheTechMargin 2026
// Нормализация настроек организатора и вывод CSS-токенов оформления.

import { describe, expect, test } from "@jest/globals";
import {
  SettingsValidationError,
  TEXT_LIMITS,
  accentTokens,
  applyStyleTokens,
  defaultEventSettings,
  heroBackgroundValue,
  heroTokens,
  normalizeEventSettings,
  coerceProjectKey,
  defaultProjectMeta,
  makeProjectKey,
  normalizeProjectMeta,
  slugifyProjectTitle,
  summarizeProject,
} from "./eventSettings";

describe("normalizeEventSettings", () => {
  test("возвращает стандартные настройки для пустого ввода", () => {
    const result = normalizeEventSettings(undefined);
    expect(result).toEqual(defaultEventSettings());
  });

  test("нормализует цвета и усекает тексты", () => {
    const defaults = defaultEventSettings();
    const result = normalizeEventSettings({
      text: {
        name: "  ",
        tagline: "x".repeat(TEXT_LIMITS.tagline + 50),
      },
      branding: {
        accent: "ABC",
        hero: { mode: "gradient", gradientFrom: "#FFF", gradientAngle: 900, overlay: 120 },
      },
    });

    // Пустое название заменяется стандартным, длинное — усечено
    expect(result.text.name).toBe(defaults.text.name);
    expect(result.text.tagline).toHaveLength(TEXT_LIMITS.tagline);
    expect(result.branding.accent).toBe("#aabbcc");
    expect(result.branding.hero.gradientFrom).toBe("#ffffff");
    expect(result.branding.hero.gradientAngle).toBe(360);
    expect(result.branding.hero.overlay).toBe(90);
  });

  test("отклоняет изображение больше лимита", () => {
    expect(() =>
      normalizeEventSettings({
        branding: { logo: `data:image/png;base64,${"A".repeat(800_000)}` },
      }),
    ).toThrow(SettingsValidationError);
  });

  test("отклоняет не-изображение вместо data URL", () => {
    expect(() =>
      normalizeEventSettings({ branding: { hero: { image: "javascript:alert(1)" } } }),
    ).toThrow(SettingsValidationError);
  });

  test("недопустимый режим фона заменяется стандартным", () => {
    const result = normalizeEventSettings({ branding: { hero: { mode: "hologram" } } });
    expect(result.branding.hero.mode).toBe("default");
  });
});

describe("hero tokens", () => {
  test("стандартный фон не переопределяется (используются глоу noveee.me)", () => {
    const hero = defaultEventSettings().branding.hero;
    expect(heroBackgroundValue(hero)).toBeNull();
    expect(heroTokens(hero)["--el-hero-bg"]).toBeUndefined();
    expect(heroTokens(hero)["--el-hero-text"]).toBe("#ffffff");
  });

  test("светлый цвет фона даёт тёмный текст", () => {
    const hero = { ...defaultEventSettings().branding.hero, mode: "color" as const, color: "#f5f5f7" };
    const tokens = heroTokens(hero);
    expect(tokens["--el-hero-bg"]).toBe("#f5f5f7");
    expect(tokens["--el-hero-text"]).toBe("#0a0a0a");
  });

  test("тёмный градиент (фиолетовый → почти чёрный) даёт белый текст", () => {
    const hero = {
      ...defaultEventSettings().branding.hero,
      mode: "gradient" as const,
      gradientFrom: "#8b5cf6",
      gradientTo: "#0a0a0e",
    };
    // Смесь двух цветов считается по байтам RGB — регрессия на сдвиг offset.
    expect(heroTokens(hero)["--el-hero-text"]).toBe("#ffffff");
  });

  test("светлый градиент (белый → серый) даёт тёмный текст", () => {
    const hero = {
      ...defaultEventSettings().branding.hero,
      mode: "gradient" as const,
      gradientFrom: "#ffffff",
      gradientTo: "#c8c8d0",
      overlay: 0,
    };
    expect(heroTokens(hero)["--el-hero-text"]).toBe("#0a0a0a");
  });

  test("затемнение может перевести светлый фон в читаемый тёмный", () => {
    const hero = {
      ...defaultEventSettings().branding.hero,
      mode: "color" as const,
      color: "#f5f5f7",
      overlay: 85,
    };
    expect(heroTokens(hero)["--el-hero-text"]).toBe("#ffffff");
  });

  test("градиент собирается из выбранных цветов и угла", () => {
    const hero = {
      ...defaultEventSettings().branding.hero,
      mode: "gradient" as const,
      gradientFrom: "#112233",
      gradientTo: "#445566",
      gradientAngle: 90,
    };
    expect(heroBackgroundValue(hero)).toBe(
      "linear-gradient(90deg, #112233 0%, #445566 100%)",
    );
  });

  test("картинка оборачивается в url()", () => {
    const hero = {
      ...defaultEventSettings().branding.hero,
      mode: "image" as const,
      image: "data:image/png;base64,AAAA",
    };
    expect(heroBackgroundValue(hero)).toBe('url("data:image/png;base64,AAAA")');
  });
});

describe("accentTokens", () => {
  test("контрастный текст считается по яркости цвета", () => {
    expect(accentTokens("#fd8d2c")["--el-on-primary"]).toBe("#000000");
    expect(accentTokens("#0f172a")["--el-on-primary"]).toBe("#ffffff");
    expect(accentTokens("#0f172a")["--el-primary"]).toBe("#0f172a");
  });
});

describe("applyStyleTokens", () => {
  /** Дубль CSSStyleDeclaration: помнит только выставленные значения. */
  const fakeTarget = () => {
    const vars = new Map<string, string>();
    return {
      vars,
      setProperty(name: string, value: string) {
        vars.set(name, value);
      },
      removeProperty(name: string) {
        vars.delete(name);
      },
    };
  };

  test("снимает переменные, которых нет в новом наборе", () => {
    const target = fakeTarget();
    const image = heroTokens({
      ...defaultEventSettings().branding.hero,
      mode: "image",
      image: "data:image/png;base64,AAAA",
    });
    const applied = applyStyleTokens(target, image);
    expect(target.vars.get("--el-hero-bg")).toBe('url("data:image/png;base64,AAAA")');
    expect(target.vars.get("--el-hero-size")).toBe("cover");

    // Возврат фона к «Стандарту»: --el-hero-bg больше не приходит,
    // но инлайн-значение должно исчезнуть, иначе старый фон остаётся.
    const standard = heroTokens(defaultEventSettings().branding.hero);
    const next = applyStyleTokens(target, standard, applied);
    expect(target.vars.has("--el-hero-bg")).toBe(false);
    expect(target.vars.has("--el-hero-size")).toBe(false);
    expect(target.vars.get("--el-hero-text")).toBe("#ffffff");
    expect(next).not.toContain("--el-hero-bg");
  });

  test("повторное применение того же набора ничего не снимает", () => {
    const target = fakeTarget();
    const tokens = heroTokens(defaultEventSettings().branding.hero);
    const first = applyStyleTokens(target, tokens);
    const second = applyStyleTokens(target, tokens, first);
    expect(new Set(second)).toEqual(new Set(first));
    expect(target.vars.get("--el-hero-scrim")).toBeDefined();
  });
});

describe("ключи и метаданные проектов", () => {
  test("slugifyProjectTitle транслитерирует и чистит название", () => {
    expect(slugifyProjectTitle("Моя свадьба 2026")).toBe("moya-svadba-2026");
    expect(slugifyProjectTitle("День Города!!")).toBe("den-goroda");
    expect(slugifyProjectTitle("  ---  ")).toBe("");
  });

  test("makeProjectKey выдаёт уникальный ключ", () => {
    expect(makeProjectKey("Моя свадьба")).toBe("moya-svadba");
    const taken = new Set(["moya-svadba"]);
    const key = makeProjectKey("Моя свадьба", (k) => taken.has(k));
    expect(key).toMatch(/^moya-svadba-[a-z0-9]+$/);
    expect(taken.has(key)).toBe(false);
    // Мусорное название не даёт пустой ключ
    expect(makeProjectKey("!!!")).toBe("project");
  });

  test("coerceProjectKey: пусто → default, мусор → null", () => {
    expect(coerceProjectKey(null)).toBe("default");
    expect(coerceProjectKey("")).toBe("default");
    expect(coerceProjectKey("default")).toBe("default");
    expect(coerceProjectKey("moya-svadba")).toBe("moya-svadba");
    expect(coerceProjectKey("Bad Key!")).toBeNull();
    expect(coerceProjectKey("../etc/passwd")).toBeNull();
  });

  test("normalizeProjectMeta проверяет дату и усекает описание", () => {
    const base = { ...defaultProjectMeta(), createdAt: "2026-01-01T00:00:00.000Z" };
    const meta = normalizeProjectMeta(
      { date: "2026-05-24", description: "  Важное мероприятие  ", archived: true },
      base,
    );
    expect(meta.date).toBe("2026-05-24");
    expect(meta.description).toBe("Важное мероприятие");
    expect(meta.archived).toBe(true);
    expect(meta.createdAt).toBe(base.createdAt);

    // Некорректная дата не затирает корректную
    const broken = normalizeProjectMeta({ date: "not-a-date" }, base);
    expect(broken.date).toBeNull();
    const kept = normalizeProjectMeta({ date: "24.05.2026" }, { ...base, date: "2026-05-24" });
    expect(kept.date).toBe("2026-05-24");
  });

  test("summarizeProject собирает сводку карточки", () => {
    const draft = defaultEventSettings();
    draft.text.name = "Картинг";
    const record = {
      draft,
      published: null,
      photos: {
        provider: "yandex" as const,
        url: "https://disk.yandex.ru/d/x",
        status: "connected" as const,
        photoCount: 387,
        folderCount: 0,
        processed: null,
        connectedAt: "2026-01-01T00:00:00.000Z",
        lastSyncAt: null,
        error: null,
      },
      meta: { ...defaultProjectMeta(), date: "2026-05-24" },
      updatedAt: "2026-02-01T00:00:00.000Z",
    };
    const summary = summarizeProject("karting", record);
    expect(summary.key).toBe("karting");
    expect(summary.title).toBe("Картинг");
    expect(summary.published).toBe(false);
    expect(summary.photos).toEqual({ connected: true, photoCount: 387, provider: "yandex" });
    expect(summary.date).toBe("2026-05-24");
    expect(summary.cover).toBeNull();

    // Опубликованный проект с фоном-обложкой
    const withCover = summarizeProject("karting", {
      ...record,
      published: draft,
      draft: {
        ...draft,
        branding: {
          ...draft.branding,
          hero: { ...draft.branding.hero, image: "data:image/png;base64,AAA" },
        },
      },
    });
    expect(withCover.published).toBe(true);
    expect(withCover.cover).toBe("data:image/png;base64,AAA");
  });
});
