// @TheTechMargin 2026
// Нормализация настроек организатора и вывод CSS-токенов оформления.

import { describe, expect, test } from "@jest/globals";
import {
  SettingsValidationError,
  TEXT_LIMITS,
  accentTokens,
  defaultEventSettings,
  heroBackgroundValue,
  heroTokens,
  normalizeEventSettings,
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
