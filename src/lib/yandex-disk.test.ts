// @TheTechMargin 2026
import {
  normalizePublicKey,
  pickSizeUrl,
  yandexFullsizeUrl,
  yandexThumbUrl,
  yandexOriginalUrl,
  YandexFile,
} from "./yandex-disk";

describe("normalizePublicKey", () => {
  it("keeps full https links", () => {
    expect(normalizePublicKey("https://disk.yandex.ru/d/abc")).toBe(
      "https://disk.yandex.ru/d/abc",
    );
  });

  it("adds https to scheme-less links", () => {
    expect(normalizePublicKey("yadi.sk/d/abc")).toBe("https://yadi.sk/d/abc");
  });

  it("trims whitespace and leading slashes", () => {
    expect(normalizePublicKey("  /disk.yandex.ru/d/x  ")).toBe(
      "https://disk.yandex.ru/d/x",
    );
  });

  it("returns empty for empty input", () => {
    expect(normalizePublicKey("")).toBe("");
    expect(normalizePublicKey("   ")).toBe("");
  });
});

describe("pickSizeUrl", () => {
  const sizes = [
    { name: "S", url: "s" },
    { name: "XL", url: "xl" },
    { name: "ORIGINAL", url: "orig" },
  ];

  it("prefers the first matching name in the list", () => {
    expect(pickSizeUrl(sizes, ["XXL", "XL"])).toBe("xl");
  });

  it("falls back to ORIGINAL", () => {
    expect(pickSizeUrl(sizes, ["XXL"])).toBe("orig");
  });

  it("falls back to the first size when nothing else matches", () => {
    const noOriginal = [
      { name: "S", url: "s" },
      { name: "L", url: "l" },
    ];
    expect(pickSizeUrl(noOriginal, ["XXL", "ORIGINAL"])).toBe("s");
  });

  it("returns empty for no sizes", () => {
    expect(pickSizeUrl([], ["XL"])).toBe("");
  });
});

function file(sizes: Array<{ name: string; url: string }>): YandexFile {
  return {
    path: "/IMG_0001.jpg",
    name: "IMG_0001.jpg",
    mimeType: "image/jpeg",
    mediaType: "image",
    size: 100,
    sizes,
  };
}

describe("yandex url helpers", () => {
  const sizes = [
    { name: "M", url: "m" },
    { name: "XL", url: "xl" },
    { name: "XXL", url: "xxl" },
    { name: "ORIGINAL", url: "orig" },
  ];

  it("thumb uses XL (closest to Drive's w640)", () => {
    expect(yandexThumbUrl(file(sizes))).toBe("xl");
  });

  it("fullsize uses XXL (closest to Drive's w1200)", () => {
    expect(yandexFullsizeUrl(file(sizes))).toBe("xxl");
  });

  it("download uses ORIGINAL", () => {
    expect(yandexOriginalUrl(file(sizes))).toBe("orig");
  });

  it("thumb falls back gracefully on sparse size lists", () => {
    expect(yandexThumbUrl(file([{ name: "S", url: "s" }]))).toBe("s");
    expect(yandexThumbUrl(file([]))).toBe("");
  });
});
