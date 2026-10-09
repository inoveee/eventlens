// @TheTechMargin 2026
import { contrastOn, normalizeHex, relativeLuminance } from "./color";

describe("relativeLuminance", () => {
  it("is 0 for black and 1 for white", () => {
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
  });

  it("is above 0.5 for bright neons and below 0.2 for navy", () => {
    expect(relativeLuminance("#00ff41")).toBeGreaterThan(0.5);
    expect(relativeLuminance("#2563eb")).toBeLessThan(0.2);
  });
});

describe("contrastOn", () => {
  it("puts black text on light brand colors", () => {
    expect(contrastOn("#00ff41")).toBe("#000000");
    expect(contrastOn("#ffff00")).toBe("#000000");
    expect(contrastOn("#ffffff")).toBe("#000000");
  });

  it("puts white text on dark brand colors", () => {
    expect(contrastOn("#000000")).toBe("#ffffff");
    expect(contrastOn("#1a1a1a")).toBe("#ffffff");
    expect(contrastOn("#2563eb")).toBe("#ffffff");
  });

  it("always returns a readable contrast ratio (>= 4.5:1)", () => {
    const ratio = (a: string, b: string) => {
      const [l1, l2] = [relativeLuminance(a), relativeLuminance(b)].sort(
        (x, y) => y - x,
      );
      return (l1 + 0.05) / (l2 + 0.05);
    };
    for (const brand of ["#00ff41", "#2563eb", "#db2777", "#ffff00", "#0a0a0a", "#f59e0b"]) {
      expect(ratio(brand, contrastOn(brand))).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("normalizeHex", () => {
  it("accepts with and without the hash", () => {
    expect(normalizeHex("#2563eb")).toBe("#2563eb");
    expect(normalizeHex("2563eb")).toBe("#2563eb");
    expect(normalizeHex("#2563EB")).toBe("#2563eb");
  });

  it("expands shorthand", () => {
    expect(normalizeHex("#f00")).toBe("#ff0000");
    expect(normalizeHex("abc")).toBe("#aabbcc");
  });

  it("returns null for empty or invalid input (dotenv comment trap)", () => {
    expect(normalizeHex("")).toBeNull();
    expect(normalizeHex(undefined)).toBeNull();
    expect(normalizeHex("not-a-color")).toBeNull();
    expect(normalizeHex("#12345")).toBeNull();
  });
});
